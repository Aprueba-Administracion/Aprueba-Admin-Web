import { Component } from 'react';

// Evita que un error de render en una vista deje toda la consola en blanco:
// muestra un aviso con "Reintentar" y el resto de la app (menú, sesión) sigue viva.
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[vista]', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const L = this.props.L || ((k) => k);
    return (
      <div className="card" role="alert" style={{ textAlign: 'center', padding: '32px 18px' }}>
        <b>{L('err_view_title')}</b>
        <p className="note" style={{ margin: '8px 0 16px' }}>{L('err_view_msg')}</p>
        <button type="button" className="btn" onClick={() => this.setState({ error: null })}>{L('retry')}</button>
      </div>
    );
  }
}
