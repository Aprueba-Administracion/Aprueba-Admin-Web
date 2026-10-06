import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { Card, StatusPill, Loading } from '../components/ui.jsx';

export default function Operations({ ctx }) {
  const { L, fmt, lang } = ctx;
  const [platforms, setPlatforms] = useState(null);
  const [services, setServices] = useState([]);
  const [containers, setContainers] = useState([]);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);

  const loaded = useRef(false);
  const load = async () => {
    try {
      const [p, s, c] = await Promise.all([api.get('/platforms'), api.get('/services'), api.get('/containers')]);
      setPlatforms(p.data); setServices(s.data); setContainers(c.data);
      loaded.current = true; setErr(null);
    } catch (e) {
      // Una falla al refrescar NO debe reemplazar toda la vista si ya había datos.
      if (loaded.current) { setMsg({ ok: false, text: e.message }); setTimeout(() => setMsg(null), 3500); } else setErr(e.message);
    }
  };
  useEffect(() => { load(); }, []);

  // Mientras algún contenedor se está reiniciando, se refresca solo cada 4 s
  // (el botón vuelve a habilitarse sin tener que recargar la página).
  const anyRestarting = containers.some((c) => c.restarting);
  useEffect(() => {
    if (!anyRestarting) return undefined;
    const id = setTimeout(load, 4000);
    return () => clearTimeout(id);
  }, [anyRestarting, containers]);

  // Un 409 (reinicio en curso) o 422 (no reiniciable) se muestra como aviso, no rompe la vista.
  const restart = async (name) => {
    try {
      await api.post(`/containers/${encodeURIComponent(name)}/restart`);
      setMsg({ ok: true, text: `${L('restarted')}: ${name}` });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    load();
    setTimeout(() => setMsg(null), 3500);
  };

  // Modelo canónico: name {es,en}, uptimePct y latencyMs numéricos. Tolera el formato anterior.
  const svcName = (s) => (s.name && typeof s.name === 'object' ? (s.name[lang] || s.name.es) : s.name);
  const svcUptime = (s) => (s.uptimePct != null ? `${s.uptimePct}%` : s.uptime);
  const svcLatency = (s) => (s.latencyMs != null ? `${s.latencyMs} ms` : s.latency);
  const day = (v) => (v ? String(v).slice(0, 10) : '—');

  if (err) return <Card><b>⛔ {err}</b></Card>;
  if (!platforms) return <Loading L={L} />;
  const dotClass = (st) => (st === 'ok' ? 'ok' : st === 'deg' ? 'deg' : 'down');

  return (
    <>
      {msg && <div className={`tag ${msg.ok ? 'g' : 'd'}`} style={{ marginBottom: 12 }}>{msg.text}</div>}
      <Card>
        <b>{L('o_stores')}</b>
        <div className="tbl-wrap" style={{ marginTop: 8 }}><table>
          <thead><tr><th>{L('o_platform')}</th><th>{L('o_version')}</th><th>{L('o_available')}</th><th>{L('o_dl')}</th><th>{L('o_updated')}</th></tr></thead>
          <tbody>{platforms.map((p) => (
            <tr key={p.id}><td><b>{p.name || p.platform}</b></td><td><span className="tag">v{p.version}</span></td>
              <td>{p.available ? <span className="tag g">{L('yes')}</span> : <span className="tag d">{L('no')}</span>}</td>
              <td>{p.downloads ? fmt(p.downloads) : '—'}</td><td className="note">{day(p.updatedAt)}</td></tr>
          ))}</tbody>
        </table></div>
      </Card>
      <div className="grid g2" style={{ marginTop: 16 }}>
        <Card>
          <b>{L('o_services')}</b>
          {services.map((s) => (
            <div key={s.id} className="svc-row">
              <span className={`dot ${dotClass(s.state)}`} />
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{svcName(s)}</div><div className="note">{L('o_uptime')} {svcUptime(s)} · {L('o_latency')} {svcLatency(s) || '—'}</div></div>
              <StatusPill state={s.state} L={L} />
            </div>
          ))}
        </Card>
        <Card>
          <b>{L('o_containers')}</b>
          <div className="tbl-wrap" style={{ marginTop: 8 }}><table>
            <thead><tr><th></th><th>{L('o_cpu')}</th><th>{L('o_mem')}</th><th></th></tr></thead>
            <tbody>{containers.map((c) => (
              <tr key={c.id}>
                <td><span className={`dot ${dotClass(c.state)}`} style={{ marginRight: 7 }} /><b style={{ fontSize: 12.5 }}>{c.name}</b><div className="note">{c.region} · {c.state === 'down' ? L('st_stop') : L('st_run')}</div></td>
                <td style={{ minWidth: 70 }}><div className="note">{c.cpu}%</div><div className="bar"><i style={{ width: `${c.cpu}%`, background: c.cpu > 75 ? 'var(--down)' : 'var(--brand)' }} /></div></td>
                <td style={{ minWidth: 70 }}><div className="note">{c.mem}%</div><div className="bar"><i style={{ width: `${c.mem}%`, background: c.mem > 80 ? 'var(--down)' : 'var(--accent)' }} /></div></td>
                <td>{c.restartable !== false && <button className="btn sec sm" disabled={c.restarting} onClick={() => restart(c.name)}>{L('o_restart')}</button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
      </div>
    </>
  );
}
