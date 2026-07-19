import L from 'leaflet'

// Animated car icon — rotates based on heading
export function makeCarIcon(heading = 0, isLive = true) {
  const color = isLive ? '#4ade80' : '#555'
  const glow  = isLive ? 'drop-shadow(0 0 6px rgba(74,222,128,0.8))' : 'none'
  const pulse = isLive ? `
    <div style="
      position:absolute;inset:-8px;border-radius:50%;
      border:2px solid rgba(74,222,128,0.4);
      animation:car-ping 1.5s ease-out infinite;
    "></div>
    <div style="
      position:absolute;inset:-16px;border-radius:50%;
      border:1.5px solid rgba(74,222,128,0.2);
      animation:car-ping 1.5s ease-out 0.4s infinite;
    "></div>
  ` : ''

  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
        ${pulse}
        <div style="
          transform:rotate(${heading}deg);
          filter:${glow};
          font-size:26px;
          line-height:1;
          transition:transform 0.5s ease;
        ">🚗</div>
      </div>
      <style>
        @keyframes car-ping {
          0%   { transform:scale(0.8); opacity:0.8; }
          70%  { transform:scale(1.8); opacity:0;   }
          100% { transform:scale(0.8); opacity:0;   }
        }
      </style>
    `,
    iconSize:    [40, 40],
    iconAnchor:  [20, 20],
    popupAnchor: [0, -24],
  })
}

// Parked car (offline)
export function makeParkedCarIcon() {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;opacity:0.45;">
        <div style="font-size:24px;line-height:1;filter:grayscale(1);">🚗</div>
      </div>
    `,
    iconSize:    [36, 36],
    iconAnchor:  [18, 18],
    popupAnchor: [0, -20],
  })
}