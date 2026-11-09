import { NAV, PLAN } from '../data/constants';

export default function ComingSoon({ k }) {
  const p = PLAN[k];
  return (
    <div className="pg"><div className="card">
      <h2>{NAV.find((n) => n[0] === k)[2]}</h2>
      <span className="pill offline">Planned for {p[0]}</span>
      <p>This screen will be built in the next phase. It will include:</p>
      <ul className="pl">{p.slice(1).map((x) => <li key={x}>{x}</li>)}</ul>
    </div></div>
  );
}
