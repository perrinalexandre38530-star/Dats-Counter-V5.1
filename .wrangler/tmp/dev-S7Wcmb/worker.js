var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/online/server/x01.ts
function createX01(startScore, order) {
  const remaining = {};
  const visits = {};
  for (const p of order) {
    remaining[p.id] = startScore;
    visits[p.id] = [];
  }
  return {
    game: "x01",
    startScore,
    players: order,
    turn: order[0].id,
    remaining,
    visits,
    legNo: 1,
    finished: null
  };
}
__name(createX01, "createX01");
function nextPlayerId(match) {
  const ids = match.players.map((p) => p.id);
  const i = ids.indexOf(match.turn);
  return ids[(i + 1) % ids.length];
}
__name(nextPlayerId, "nextPlayerId");
function applyVisit(match, playerId, darts) {
  if (match.finished) return match;
  if (playerId !== match.turn) return match;
  const sum = darts.reduce((a, b) => a + b, 0);
  const current = match.remaining[playerId];
  const next = current - sum;
  if (next < 0 || next === 1) {
    match.visits[playerId].push(darts);
    match.turn = nextPlayerId(match);
    return match;
  }
  if (next === 0) {
    match.visits[playerId].push(darts);
    match.remaining[playerId] = 0;
    const order = computeOrder(match);
    match.finished = { winnerId: playerId, order };
    return match;
  }
  match.remaining[playerId] = next;
  match.visits[playerId].push(darts);
  match.turn = nextPlayerId(match);
  return match;
}
__name(applyVisit, "applyVisit");
function undoLast(match) {
  if (match.finished) {
    match.finished = null;
  }
  const startScore = match.startScore;
  const order = match.players.map((p) => p.id);
  for (const p of order) {
    match.remaining[p] = startScore;
  }
  const flat = [];
  const maxLen = Math.max(...order.map((pid) => match.visits[pid].length));
  for (let i = 0; i < maxLen; i++) {
    for (const pid of order) {
      const v = match.visits[pid][i];
      if (v) flat.push({ pid, darts: v });
    }
  }
  flat.pop();
  for (const pid of order) match.visits[pid] = [];
  match.turn = order[0];
  for (const step of flat) applyVisit(match, step.pid, step.darts);
  return match;
}
__name(undoLast, "undoLast");
function computeOrder(match) {
  const ids = match.players.map((p) => p.id);
  return ids.sort((a, b) => {
    const ra = match.remaining[a];
    const rb = match.remaining[b];
    if (ra === 0 && rb !== 0) return -1;
    if (rb === 0 && ra !== 0) return 1;
    if (ra !== rb) return ra - rb;
    const va = match.visits[a].length;
    const vb = match.visits[b].length;
    return va - vb;
  });
}
__name(computeOrder, "computeOrder");

// src/online/server/worker.ts
var worker_default = {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === "/ws" && req.headers.get("Upgrade") === "websocket") {
      const roomId = url.searchParams.get("roomId") || "default";
      const id = env.ROOMS.idFromName(roomId);
      const stub = env.ROOMS.get(id);
      return await stub.fetch(req);
    }
    return new Response("OK", { status: 200 });
  }
};
var RoomDO = class {
  static {
    __name(this, "RoomDO");
  }
  state;
  env;
  roomId;
  sockets = /* @__PURE__ */ new Map();
  v = 0;
  data;
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.roomId = state.id.name || "default";
    this.data = {
      roomId: this.roomId,
      clients: [],
      match: null
    };
  }
  async fetch(req) {
    const upgrade = req.headers.get("Upgrade");
    const origin = req.headers.get("Origin") || "";
    const allow = (this.env.ALLOW_ORIGINS || "").split(",").map((s) => s.trim());
    if (allow.length && origin && !allow.includes(origin)) {
      return new Response("Forbidden origin", { status: 403 });
    }
    if (upgrade !== "websocket") return new Response("Expected WS", { status: 400 });
    const [client, server] = Object.values(new WebSocketPair());
    await this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }
  // Durable Objects WS Handlers
  async webSocketMessage(ws, raw) {
    try {
      const msg = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw));
      await this.handleEvent(ws, msg);
    } catch (e) {
      this.send(ws, { t: "error", code: "bad_json", msg: e?.message || String(e) });
    }
  }
  async webSocketClose(ws) {
    for (const [pid, sock] of this.sockets) {
      if (sock === ws) this.sockets.delete(pid);
    }
  }
  async webSocketError(ws) {
  }
  send(ws, ev) {
    try {
      ws.send(JSON.stringify(ev));
    } catch {
    }
  }
  broadcast(ev) {
    const payload = JSON.stringify(ev);
    for (const [, sock] of this.sockets) {
      try {
        sock.send(payload);
      } catch {
      }
    }
  }
  bumpAndBroadcast() {
    this.v++;
    this.broadcast({ t: "server_update", v: this.v, state: this.data });
  }
  getPlayer(pid) {
    return this.data.clients.find((c) => c.id === pid) || null;
  }
  ensureSocketBound(ws, pid) {
    const existing = this.sockets.get(pid);
    if (existing && existing !== ws) {
      try {
        existing.close();
      } catch {
      }
    }
    this.sockets.set(pid, ws);
  }
  ensureMatchExists() {
    if (!this.data.match) throw new Error("no_match");
  }
  assertTurn(pid) {
    this.ensureMatchExists();
    if (this.data.match.turn !== pid) throw new Error("not_your_turn");
  }
  startX01(startScore, order) {
    this.data.match = createX01(startScore, order);
  }
  async handleEvent(ws, ev) {
    switch (ev.t) {
      case "ping":
        return this.send(ws, { t: "pong" });
      case "join_room": {
        this.ensureSocketBound(ws, ev.playerId);
        if (!this.getPlayer(ev.playerId)) {
          this.data.clients.push({ id: ev.playerId, name: ev.name });
        } else {
          this.data.clients = this.data.clients.map((c) => c.id === ev.playerId ? { ...c, name: ev.name } : c);
        }
        this.bumpAndBroadcast();
        return;
      }
      case "start_match": {
        if (ev.start.game !== "x01") {
          this.send(ws, { t: "error", code: "unsupported_game", msg: "Only x01 in v1" });
          return;
        }
        const players = ev.start.order.map((pid) => {
          const c = this.getPlayer(pid);
          if (!c) throw new Error("unknown_player:" + pid);
          return c;
        });
        this.startX01(ev.start.startScore, players);
        this.bumpAndBroadcast();
        return;
      }
      case "throw_visit": {
        this.ensureMatchExists();
        const pid = [...this.sockets.entries()].find(([, s]) => s === ws)?.[0];
        if (!pid) throw new Error("no_player_bound");
        this.assertTurn(pid);
        const m = this.data.match;
        applyVisit(m, pid, ev.darts);
        this.bumpAndBroadcast();
        return;
      }
      case "undo_last": {
        this.ensureMatchExists();
        const m = this.data.match;
        undoLast(m);
        this.bumpAndBroadcast();
        return;
      }
      case "leave_room": {
        const pid = [...this.sockets.entries()].find(([, s]) => s === ws)?.[0];
        if (pid) this.sockets.delete(pid);
        this.bumpAndBroadcast();
        return;
      }
    }
  }
};

// ../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-EacNSk/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-EacNSk/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  RoomDO,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
