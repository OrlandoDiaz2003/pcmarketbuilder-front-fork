import { stripLogoutState } from './clean-url';

describe('stripLogoutState', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('quita el ?state= que Microsoft agrega al volver del logout y conserva lo demás', () => {
    window.history.replaceState(null, '', '/cart?state=eyJpZCI6IjEifQ%3D%3D&x=1#frag');
    stripLogoutState();
    expect(window.location.pathname).toBe('/cart');
    expect(window.location.search).toBe('?x=1');
    expect(window.location.hash).toBe('#frag');
  });

  it('no toca la URL si no hay state en la query (ni el state del hash de una respuesta de login)', () => {
    window.history.replaceState(null, '', '/#code=abc&state=xyz');
    stripLogoutState();
    expect(window.location.hash).toBe('#code=abc&state=xyz');
    expect(window.location.search).toBe('');
  });
});
