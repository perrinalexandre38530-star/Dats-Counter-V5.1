// src/components/ErrorBoundary.tsx
import React from "react";

type Props = { children: React.ReactNode; fallback?: React.ReactNode };
type State = { hasError: boolean; info?: string };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: any) {
    console.warn("[ErrorBoundary]", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div style={{ padding: 16, color: "#f88" }}>
            Une erreur est survenue dans ce composant.
          </div>
        )
      );
    }
    return this.props.children;
  }
}
