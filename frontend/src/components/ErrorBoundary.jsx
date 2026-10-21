import { Component } from "react";

import ErrorPage from "../pages/ErrorPage";

/**
 * Catches unexpected render errors anywhere below it and shows the 500 page
 * instead of a blank white screen.
 */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("Unhandled UI error:", error, info);
  }

  render() {
    if (this.state.failed) {
      return <ErrorPage status={500} />;
    }

    return this.props.children;
  }
}
