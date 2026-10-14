import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Crosshair, Info, MapPin, Minus, Plus, X } from 'lucide-react';
import { RoomCard } from './Group.jsx';
import { ST } from './logic.js';

// Bản đồ vector của HUSTMAP (hustmap.com): style + sprite + font + tile (z16-18) đều tự host ở /hustmap (web/public/hustmap).
// lng/lat lấy từ API tìm kiếm HUSTMAP; "gate" và "food" là vị trí gần đúng [VERIFY NEEDED].
const HOME = { center: [105.8442, 21.0038], zoom: 17.5 };
const BOUNDS = [[105.835, 20.995], [105.853, 21.012]];
const PLACES = [
  { key: 'd9-f1', label: 'Tầng 1 - Tòa D9', hint: 'Phòng D9-101 → D9-106', lng: 105.84405, lat: 21.00375, match: /D9-10/i },
  { key: 'd9-f2', label: 'Tầng 2 - Tòa D9', hint: 'Phòng D9-202 → D9-206 (Nghỉ: D9-201)', lng: 105.84418, lat: 21.00378, match: /D9-20/i },
  { key: 'd9-f3', label: 'Tầng 3 - Tòa D9', hint: 'Phòng D9-302 → D9-306 (Điều hành: D9-301)', lng: 105.84431, lat: 21.00381, match: /D9-30/i },
  { key: 'd9-f4', label: 'Tầng 4 - Tòa D9', hint: 'Phòng D9-401 → D9-406', lng: 105.84444, lat: 21.00384, match: /D9-40/i },
  { key: 'd9-f5', label: 'Tầng 5 - Tòa D9', hint: 'Phòng D9-501 → D9-506', lng: 105.84457, lat: 21.00387, match: /D9-50/i },
];

const PIN_SVG = '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" stroke="#fff" stroke-width="1.5" aria-hidden="true"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3" fill="#fff" stroke="none"/></svg>';

const placeStatus = (place) => place.rooms.some((room) => room.status === 'red') ? 'red' : place.rooms.some((room) => room.status === 'yellow') ? 'yellow' : 'green';

export default function MapView({ groups, me, act }) {
  const [selectedKey, setSelectedKey] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const chooseRef = useRef(null);
  const { rooms, places, activePlaces } = useMemo(() => {
    const r = groups.flatMap((group) => group.rooms);
    const p = PLACES.map((place) => ({ ...place, rooms: r.filter((room) => place.match.test(room.name)) }));
    return { rooms: r, places: p, activePlaces: p.filter((place) => place.rooms.length) };
  }, [groups]);
  const selectedPlace = places.find((place) => place.key === selectedKey);
  const selectedRoom = selectedPlace?.rooms.find((room) => room.id === selectedId);

  const choosePlace = useCallback((place) => {
    setSelectedKey(place.key);
    setSelectedId(place.rooms.length === 1 ? place.rooms[0].id : null);
    const map = mapRef.current;
    if (map) map.flyTo({ center: [place.lng, place.lat], zoom: Math.max(map.getZoom(), 18.5), duration: 900, essential: true });
  }, []);
  chooseRef.current = choosePlace;
  const close = () => { setSelectedKey(null); setSelectedId(null); };

  // Khởi tạo bản đồ một lần
  useEffect(() => {
    let cancelled = false;
    let map = null;
    let observer = null;
    let loadTimer = null;
    (async () => {
      try {
        const res = await fetch('/hustmap/style.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const style = await res.json();
        if (cancelled) return;
        style.sprite = `${location.origin}/hustmap/sprite/sprite`;
        style.glyphs = `${location.origin}/hustmap/fonts/{fontstack}/{range}.pbf`;
        // Tile đã tải về web/public/hustmap/tiles (z16-18, phủ khuôn viên), không còn gọi server HUSTMAP
        Object.values(style.sources).forEach((source) => { if (source.type === 'vector') { source.tiles = [`${location.origin}/hustmap/tiles/{z}/{x}/{y}.pbf`]; delete source.url; } });
        map = new maplibregl.Map({ container: containerRef.current, style, ...HOME, minZoom: 16, maxZoom: 20, maxBounds: BOUNDS, attributionControl: false, dragRotate: false });
        map.touchZoomRotate.disableRotation();
        map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'Bản đồ © HUSTMAP' }), 'bottom-left');
        loadTimer = setTimeout(() => { if (!cancelled && !map?.loaded()) setFailed(true); }, 10000);
        map.on('load', () => { clearTimeout(loadTimer); if (!cancelled) setReady(true); });
        map.on('error', (e) => {
          if (!map.loaded() && !cancelled && (e?.error?.status >= 400 || e?.error?.message)) {
            clearTimeout(loadTimer);
            setFailed(true);
          }
        });
        mapRef.current = map;
        observer = new ResizeObserver(() => map.resize());
        observer.observe(containerRef.current);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(loadTimer);
      observer?.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Cắm marker theo trạng thái khu (đỏ/vàng/xanh); dựng lại khi trạng thái hoặc số khu đổi
  const signature = activePlaces.map((place) => `${place.key}:${placeStatus(place)}:${place.rooms.length}`).join('|');
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return undefined;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();
    activePlaces.forEach((place) => {
      const status = placeStatus(place);
      const anchor = document.createElement('div');
      anchor.className = 'campus-marker-anchor';
      anchor.dataset.key = place.key;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `campus-marker ${status}`;
      button.setAttribute('aria-label', `${place.label}: ${place.rooms.length} khu vực (${ST[status]})`);
      button.innerHTML = `${PIN_SVG}<span></span><b>${place.rooms.length}</b>`;
      button.querySelector('span').textContent = place.label;
      button.addEventListener('click', (event) => { event.stopPropagation(); chooseRef.current(place); });
      anchor.appendChild(button);
      markersRef.current.set(place.key, new maplibregl.Marker({ element: anchor, anchor: 'center' }).setLngLat([place.lng, place.lat]).addTo(map));
    });
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signature]);

  // Đánh dấu marker đang chọn
  useEffect(() => {
    markersRef.current.forEach((marker, key) => marker.getElement()?.querySelector('.campus-marker')?.classList.toggle('selected', key === selectedKey));
  }, [selectedKey, signature, ready]);

  const zoomBy = (delta) => mapRef.current?.easeTo({ zoom: mapRef.current.getZoom() + delta, duration: 250 });
  const reset = () => mapRef.current?.flyTo({ ...HOME, duration: 700 });

  return <div className="map-page">
    <div className="detail-heading map-heading"><div><span className="detail-kicker">BẢN ĐỒ SỰ KIỆN</span><h2>Khám phá khuôn viên</h2><p>Chọn một điểm trên bản đồ để xem khu vực và công việc liên quan.</p></div><span className="map-legend"><i className="red" />Chưa sẵn sàng <i className="yellow" />Đang chuẩn bị <i className="green" />Sẵn sàng</span></div>
    <div className="campus-layout">
      <div className="campus-viewport" aria-label="Bản đồ tương tác khuôn viên HUST">
        <div className="campus-map" ref={containerRef} />
        {!ready && !failed && <div className="campus-loading">Đang tải bản đồ…</div>}
        {failed && <div className="campus-loading error">Không tải được bản đồ. Kiểm tra kết nối rồi tải lại trang.</div>}
        <div className="campus-tools" aria-label="Điều khiển bản đồ">
          <button onClick={() => zoomBy(1)} aria-label="Phóng to" title="Phóng to"><Plus size={18} /></button>
          <button onClick={() => zoomBy(-1)} aria-label="Thu nhỏ" title="Thu nhỏ"><Minus size={18} /></button>
          <button onClick={reset} aria-label="Về toàn cảnh" title="Về toàn cảnh"><Crosshair size={18} /></button>
        </div>
      </div>
      <aside className={`campus-panel ${selectedPlace ? 'has-selection' : ''}`} aria-label="Danh sách điểm trên bản đồ">
        {selectedPlace ? <><div className="campus-panel-head"><div><small>ĐIỂM ĐƯỢC CHỌN</small><h3>{selectedPlace.label}</h3><p>{selectedPlace.hint}</p></div><button className="campus-close" onClick={close} aria-label="Đóng chi tiết"><X size={19} /></button></div><div className="campus-panel-body"><div className="campus-room-list">{selectedPlace.rooms.map((room) => <button key={room.id} className={`campus-room-link ${room.status} ${selectedId === room.id ? 'active' : ''}`} aria-label={`${room.name} (${ST[room.status]})`} onClick={() => setSelectedId(room.id)}><i aria-hidden="true" />{room.name}<span>›</span></button>)}</div>{selectedRoom && <RoomCard key={selectedRoom.id} room={selectedRoom} me={me} act={act} initialOpen />}</div></> : <><div className="campus-panel-head"><div><small>ĐIỂM SỰ KIỆN</small><h3>Danh sách khu vực</h3><p>{rooms.length} khu vực trong {activePlaces.length} điểm</p></div></div><div className="campus-panel-body"><div className="campus-place-list">{activePlaces.map((place) => <button key={place.key} onClick={() => choosePlace(place)}><span className={`campus-place-icon ${placeStatus(place)}`}><MapPin size={18} /></span><span><strong>{place.label}</strong><small>{place.rooms.length} khu vực · {place.hint}</small></span><span className="campus-arrow">›</span></button>)}</div><p className="campus-help"><Info size={15} />Chọn điểm trên bản đồ hoặc trong danh sách để xem checklist.</p></div></>}
      </aside>
    </div>
    <p className="map-caption">Kéo để di chuyển; dùng con lăn, hai ngón hoặc nút +/− để phóng to, thu nhỏ. Nền bản đồ © HUSTMAP (hustmap.com); vị trí điểm sự kiện là tương đối, không dùng để dẫn đường chính xác.</p>
  </div>;
}
