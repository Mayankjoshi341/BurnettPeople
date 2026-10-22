import { Component } from "react";

/* Catches crashes while rendering a page and shows the 500 screen instead of a blank page.
   resetKey: when it changes (e.g. the user navigates), the boundary tries to render normally again. */
export default class RouteErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Developer console only; nothing is sent anywhere.
    console.error("A page crashed while rendering:", error, info?.componentStack);
  }

  componentDidUpdate(previous) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) return this.props.fallback(this.reset);
    return this.props.children;
  }
}