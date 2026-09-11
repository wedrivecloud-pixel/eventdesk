import { Image as ImageIcon } from 'lucide-react';
import { details } from '@/lib/manage-config';
import type { Resource } from '@/lib/settings';
export function DesignPreview({ item }: { item: Resource }) {
  const primary = details(item).images[0];
  if (primary)
    return (
      <img
        className="design-preview"
        src={'/api/media?id=' + encodeURIComponent(primary)}
        alt={item.name}
      />
    );
  const preset = String(item.data.preset || '');
  if (!preset)
    return (
      <div className="design-placeholder">
        <ImageIcon size={32} />
        <span>{item.name}</span>
      </div>
    );
  const strip = preset.startsWith('2x6'),
    landscape = preset.includes('Landscape') || preset.includes('Top'),
    count = Number(preset.match(/ (\d) Photo/)?.[1] || 1);
  const w = strip ? 120 : landscape ? 240 : 160,
    h = strip ? 360 : landscape ? 160 : 240;
  let boxes: number[][];
  if (strip)
    boxes = Array.from({ length: count }, (_, i) => [
      10,
      10 + (i * (h - 65)) / count,
      w - 20,
      (h - 65) / count - 8,
    ]);
  else if (count === 1) boxes = [[12, 12, w - 24, h - 55]];
  else if (count === 2)
    boxes = preset.includes('Side')
      ? [
          [12, 12, 64, 175],
          [84, 12, 64, 175],
        ]
      : [
          [12, 12, 104, 102],
          [124, 12, 104, 102],
        ];
  else if (count === 3 && preset.endsWith('A'))
    boxes = [
      [12, 12, 136, 94],
      [12, 114, 64, 70],
      [84, 114, 64, 70],
    ];
  else if (count === 3 && preset.endsWith('B'))
    boxes = [
      [12, 12, 64, 70],
      [84, 12, 64, 70],
      [12, 90, 136, 94],
    ];
  else if (count === 3)
    boxes = [
      [12, 12, 136, 50],
      [12, 70, 136, 50],
      [12, 128, 136, 50],
    ];
  else
    boxes = [
      [12, 12, 64, 80],
      [84, 12, 64, 80],
      [12, 100, 64, 80],
      [84, 100, 64, 80],
    ];
  return (
    <div className="design-schematic">
      <svg
        role="img"
        aria-label={preset + ' layout diagram'}
        viewBox={`0 0 ${w} ${h}`}
      >
        <rect
          x="1"
          y="1"
          width={w - 2}
          height={h - 2}
          fill="white"
          stroke="#bcc5d9"
        />
        {boxes.map(([x, y, bw, bh], i) => (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={bw}
              height={bh}
              fill="#e7edf8"
              stroke="#aab9d3"
            />
            <text
              x={x + bw / 2}
              y={y + bh / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="10"
              fill="#445676"
            >
              Photo {i + 1}
            </text>
          </g>
        ))}
        <text
          x={w / 2}
          y={h - 24}
          textAnchor="middle"
          fontSize="10"
          fill="#445676"
        >
          Your event text
        </text>
      </svg>
    </div>
  );
}
