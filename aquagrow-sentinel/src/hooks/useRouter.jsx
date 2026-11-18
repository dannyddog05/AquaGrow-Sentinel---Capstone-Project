import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const RouterCtx = createContext(null);

const readLoc = () => ({
  pathname: window.location.pathname || '/',
  search: window.location.search || '',
  hash: window.location.hash || '',
});

export function RouterProvider({ children }) {
  const [loc, setLoc] = useState(readLoc);

  useEffect(() => {
    const sync = () => setLoc(readLoc());
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    const url = new URL(to, window.location.origin);
    const next = url.pathname + url.search + url.hash;
    const current = window.location.pathname + window.location.search + window.location.hash;
    if (next !== current) {
      window.history[replace ? 'replaceState' : 'pushState'](null, '', next);
    }
    setLoc(readLoc());
  }, []);

  const value = useMemo(() => ({ loc, navigate }), [loc, navigate]);
  return <RouterCtx.Provider value={value}>{children}</RouterCtx.Provider>;
}

export function useLocation() {
  return useContext(RouterCtx).loc;
}

export function useNavigate() {
  return useContext(RouterCtx).navigate;
}

export function useSearchParams() {
  const { loc, navigate } = useContext(RouterCtx);
  const params = useMemo(() => new URLSearchParams(loc.search), [loc.search]);

  const setParams = useCallback(
    (nextInit, { replace = false } = {}) => {
      const next = nextInit instanceof URLSearchParams ? nextInit : new URLSearchParams(nextInit);
      const qs = next.toString();
      navigate(`${loc.pathname}${qs ? `?${qs}` : ''}`, { replace });
    },
    [loc.pathname, navigate]
  );

  return [params, setParams];
}

export function Link({ to, replace, onClick, children, ...rest }) {
  const navigate = useNavigate();
  const handleClick = (e) => {
    if (onClick) onClick(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigate(to, { replace });
  };
  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
