/* Offline vector map of Bengaluru, styled like a standard web map. No tiles, no network. Geometry is approximate. */
function bengaluruMapSvg(m) {
  const B = { la0: 12.82, la1: 13.12, lo0: 77.46, lo1: 77.78 }, W = 360, H = 346;
  if (m.lat == null) return '<div class="nomap">No GPS position in this file.</div>';
  if (m.lat < B.la0 || m.lat > B.la1 || m.lon < B.lo0 || m.lon > B.lo1)
    return `<div class="nomap"><b>Outside the offline Bengaluru map</b><br>${m.lat.toFixed(5)}, ${m.lon.toFixed(5)}</div>`;
  const P = ([la, lo]) => [(lo - B.lo0) / (B.lo1 - B.lo0) * W, (B.la1 - la) / (B.la1 - B.la0) * H];
  const f = n => n.toFixed(1);
  const smooth = (a, closed) => {
    const p = a.map(P), n = p.length, mid = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
    let d;
    if (closed) {
      const s = mid(p[n - 1], p[0]); d = `M${f(s[0])},${f(s[1])}`;
      for (let i = 0; i < n; i++) { const e = mid(p[i], p[(i + 1) % n]); d += `Q${f(p[i][0])},${f(p[i][1])} ${f(e[0])},${f(e[1])}`; }
      return d + 'Z';
    }
    d = `M${f(p[0][0])},${f(p[0][1])}`;
    for (let i = 1; i < n - 1; i++) { const e = mid(p[i], p[i + 1]); d += `Q${f(p[i][0])},${f(p[i][1])} ${f(e[0])},${f(e[1])}`; }
    return d + `L${f(p[n - 1][0])},${f(p[n - 1][1])}`;
  };
  const path = (a, attrs, closed) => `<path d="${smooth(a, closed)}" ${/fill=/.test(attrs) ? '' : 'fill="none"'} stroke-linecap="round" stroke-linejoin="round" ${attrs}/>`;
  const ell = (c, rx, ry, rot, attrs) => { const [x, y] = P(c); return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${f(x)} ${f(y)})" ${attrs}/>`; };

  const LAND = '#f2efe9', BUILT = '#e9e5dc', WATER = '#aadaff', PARK = '#c8e6bd';
  const built = [[13.07, 77.57], [13.06, 77.65], [13.01, 77.73], [12.97, 77.78], [12.92, 77.75], [12.87, 77.70], [12.84, 77.67], [12.83, 77.62], [12.88, 77.58], [12.90, 77.52], [12.95, 77.49], [13.01, 77.50]];
  const parks = path([[12.82, 77.54], [12.83, 77.60], [12.86, 77.63], [12.84, 77.66], [12.82, 77.68], [12.82, 77.54]], `fill="${PARK}"`, true) +
    ell([12.9763, 77.5929], 17, 8, 15, `fill="${PARK}"`) + ell([12.9507, 77.5848], 9, 11, 0, `fill="${PARK}"`) +
    ell([13.0100, 77.5400], 12, 6, 0, `fill="${PARK}"`) + ell([12.99, 77.70], 10, 6, 0, `fill="${PARK}"`);
  const water = [[[12.9826, 77.6190], 6, 3.5, 20], [[13.0450, 77.5920], 12, 6, -20], [[13.0100, 77.5730], 7, 4, 0], [[12.9370, 77.6700], 14, 6, -30],
    [[12.9400, 77.7400], 14, 5, 10], [[12.9220, 77.6450], 5, 3, 0], [[12.9170, 77.6180], 5, 3, 0], [[13.1000, 77.5900], 14, 5, 0], [[12.8900, 77.5900], 5, 3, 0]]
    .map(w => ell(w[0], w[1], w[2], w[3], `fill="${WATER}"`)).join('');

  const MAJ = [12.9767, 77.5713];
  const minor = [[[12.99, 77.55], [12.96, 77.60], [12.95, 77.66]], [[13.01, 77.62], [12.98, 77.66], [12.93, 77.70]], [[12.94, 77.52], [12.93, 77.58], [12.90, 77.64]],
    [[13.03, 77.57], [13.0, 77.62], [12.97, 77.66]], [[12.90, 77.60], [12.88, 77.66], [12.87, 77.72]], [[13.0, 77.60], [12.96, 77.58], [12.92, 77.60]], [[12.96, 77.70], [12.93, 77.74], [12.90, 77.74]]]
    .map(a => path(a, 'stroke="#d3d0c8" stroke-width="1.7"') + path(a, 'stroke="#fff" stroke-width="1.1"')).join('');
  const arterial = [[MAJ, [12.99, 77.585], [13.0358, 77.597], [13.10, 77.605]], [MAJ, [12.96, 77.53], [12.9140, 77.4830]], [[12.9760, 77.6300], [12.9698, 77.7500]],
    [[12.9250, 77.5800], [12.87, 77.555], [12.82, 77.54]], [[12.9350, 77.6000], [12.88, 77.60], [12.83, 77.58]], [[12.9352, 77.6245], [12.91, 77.68], [12.88, 77.76]], [MAJ, [13.0100, 77.5300], [13.0500, 77.4800]]];
  const hwy = [[MAJ, [12.9352, 77.6000], [12.9170, 77.6230], [12.8452, 77.6602]], [[12.9784, 77.6408], [12.99, 77.67], [12.998, 77.69], [13.07, 77.78]]];
  const orr = [[13.0358, 77.597], [13.0450, 77.62], [13.0100, 77.696], [12.9591, 77.6974], [12.9260, 77.676], [12.9170, 77.623], [12.9150, 77.570], [12.9300, 77.520], [12.9600, 77.505], [13.0000, 77.510], [13.0285, 77.530]];
  const nice = [[13.10, 77.50], [13.04, 77.47], [12.96, 77.47], [12.89, 77.50], [12.84, 77.56], [12.83, 77.64], [12.86, 77.73], [12.93, 77.78]];
  const roads = arterial.map(a => path(a, 'stroke="#c8c4bb" stroke-width="3"') + path(a, 'stroke="#fff" stroke-width="2.1"')).join('') +
    [nice].map(a => path(a, 'stroke="#e0b24f" stroke-width="3.2"') + path(a, 'stroke="#fde293" stroke-width="2.2"')).join('') +
    hwy.map(a => path(a, 'stroke="#e0b24f" stroke-width="4"') + path(a, 'stroke="#fde293" stroke-width="2.8"')).join('') +
    path(orr, 'stroke="#e0b24f" stroke-width="4.4"', true) + path(orr, 'stroke="#fde293" stroke-width="3.1"', true);

  const SANS = "font-family:Roboto,'Helvetica Neue',Arial,system-ui,sans-serif";
  const halo = 'paint-order:stroke;stroke:#f7f5f0;stroke-width:1.4px;stroke-linejoin:round';
  const lbl = (name, c, side, st, size) => {
    const [x, y] = P(c); if (side === 'r' && x > W - 55) side = 'l';
    const o = { r: [3, 1.6, 'start'], l: [-3, 1.6, 'end'], a: [0, -3.4, 'middle'], b: [0, 6, 'middle'] }[side];
    return `<text x="${f(x + o[0])}" y="${f(y + o[1])}" text-anchor="${o[2]}" style="${st};${halo}" font-size="${size}">${name}</text>`;
  };
  const dot = c => `<circle cx="${f(P(c)[0])}" cy="${f(P(c)[1])}" r=".9" fill="#80868b"/>`;
  const place = (n, c, s = 'r') => dot(c) + lbl(n, c, s, `${SANS};font-weight:500;fill:#5f6368`, 4.3);
  const water_l = (n, c, s = 'b') => lbl(n, c, s, `${SANS};font-weight:500;fill:#5b8fc0`, 3.8);
  const park_l = (n, c, s = 'b') => lbl(n, c, s, `${SANS};font-weight:500;fill:#4f8a4f`, 3.8);
  const road_l = (n, c) => lbl(n, c, 'a', `${SANS};font-weight:500;fill:#8a7a52`, 3.4);
  const labels = [
    lbl('Bengaluru', [12.9716, 77.5946], 'a', `${SANS};font-weight:500;fill:#3c4043;letter-spacing:.4px`, 7.2),
    place('Indiranagar', [12.9784, 77.6408]), place('Koramangala', [12.9352, 77.6245]), place('Jayanagar', [12.925, 77.5938], 'l'),
    place('Hebbal', [13.0358, 77.597]), place('Yelahanka', [13.1007, 77.5963]), place('Yeshwanthpur', [13.0285, 77.54], 'l'),
    place('Whitefield', [12.9698, 77.75]), place('Marathahalli', [12.9591, 77.6974]), place('HSR Layout', [12.9116, 77.6389]), place('Banashankari', [12.9255, 77.5468], 'l'),
    place('Kengeri', [12.914, 77.483]), place('Electronic City', [12.8452, 77.6602]), place('KR Puram', [13.01, 77.696]), place('Majestic', MAJ, 'l'),
    park_l('Cubbon Park', [12.9763, 77.5929], 'b'), park_l('Lalbagh', [12.9507, 77.5848], 'r'), water_l('Bellandur Lake', [12.937, 77.67], 'b'), water_l('Hebbal Lake', [13.045, 77.592], 'a'),
    water_l('Ulsoor Lake', [12.9826, 77.619], 'a'), water_l('Varthur Lake', [12.94, 77.74], 'b'), park_l('Bannerghatta National Park', [12.835, 77.6], 'a'),
    road_l('Outer Ring Rd', [13.0450, 77.62]), road_l('Hosur Rd', [12.9100, 77.6130]), road_l('Bellary Rd', [13.07, 77.601])
  ].join('');

  const [px, py] = P([m.lat, m.lon]);
  const vw = 210, vh = vw * H / W, vx = px - vw / 2, vy = py - vh / 2;   // pin always centred
  const kmu = W / ((B.lo1 - B.lo0) * 108), sb = 5 * kmu, sx = vx + 7, sy = vy + vh - 7;
  const scale = `<g style="${SANS}" font-size="3.6" fill="#3c4043"><path d="M${f(sx)} ${f(sy - 2)}V${f(sy)}H${f(sx + sb)}V${f(sy - 2)}" fill="none" stroke="#3c4043" stroke-width=".7"/><text x="${f(sx + sb + 2)}" y="${f(sy)}" style="${halo}">5 km</text></g>`;
  const pin = `<g transform="translate(${f(px)} ${f(py)})"><circle class="ring" r="9" fill="#4285f4" opacity=".28"/><circle r="9" fill="#4285f4" opacity=".14" stroke="#4285f4" stroke-width=".5"/>
<ellipse cx="0" cy=".4" rx="3.2" ry="1.1" fill="#000" opacity=".3"/><path d="M0 0C-3.4-5-7-8.2-7-13.4a7 7 0 1 1 14 0C7-8.2 3.4-5 0 0Z" fill="#ea4335" stroke="#b31412" stroke-width=".6"/><circle cx="0" cy="-13.4" r="2.6" fill="#7f1d1d"/></g>`;
  const hemi = `${Math.abs(m.lat).toFixed(5)}° ${m.lat < 0 ? 'S' : 'N'}, ${Math.abs(m.lon).toFixed(5)}° ${m.lon < 0 ? 'W' : 'E'}`;
  return `<svg viewBox="${f(vx)} ${f(vy)} ${f(vw)} ${f(vh)}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Offline map of Bengaluru with a pin at ${hemi}">
<defs><pattern id="msGrid" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(14)"><path d="M0 0H7M0 0V7" stroke="#fff" stroke-width=".55" opacity=".38"/></pattern>
<pattern id="msGrid2" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)"><path d="M0 0H11M0 0V11" stroke="#fff" stroke-width=".5" opacity=".28"/></pattern></defs>
<rect x="-400" y="-400" width="${W + 800}" height="${H + 800}" fill="${LAND}"/>${path(built, `fill="${BUILT}"`, true)}${path(built, 'fill="url(#msGrid)"', true)}
${path([[13.05, 77.60], [13.0, 77.52], [12.92, 77.52], [12.88, 77.58], [12.95, 77.62]], 'fill="url(#msGrid2)"', true)}${parks}${water}${minor}${roads}${labels}${scale}${pin}</svg>
<div class="mchip"><span>Pin location</span><b>${hemi}</b></div><div class="mzoom" aria-hidden="true"><i>+</i><i>&minus;</i></div><div class="mattr">Offline map &middot; no network used</div>`;
}
