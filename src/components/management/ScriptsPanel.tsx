import { useState } from "react";
import { Map, RefreshCw, Cloud, Table2, ImageIcon, Play } from "lucide-react";

interface Script {
  id: string;
  name: string;
  language: "Python" | "Shell" | "JS";
  description: string;
  tags: string[];
  icon: React.ComponentType<{ size?: number; color?: string }>;
}

const SCRIPTS: Script[] = [
  {
    id: "overture",
    name: "Overture Maps Download",
    language: "Python",
    description: "Download Overture Maps building/POI data from S3. Free, no API key.",
    tags: ["geo", "maps", "data"],
    icon: Map,
  },
  {
    id: "gdal",
    name: "GDAL Format Converter",
    language: "Shell",
    description: "Convert between GIS formats (GeoJSON, Shapefile, GeoPackage).",
    tags: ["geo", "conversion"],
    icon: RefreshCw,
  },
  {
    id: "osm",
    name: "OSM Data Extract",
    language: "Python",
    description: "Extract OpenStreetMap data for any bbox using Overpass API.",
    tags: ["geo", "osm"],
    icon: Cloud,
  },
  {
    id: "csv-geojson",
    name: "CSV to GeoJSON",
    language: "JS",
    description: "Convert tabular CSV with lat/lon columns to GeoJSON format.",
    tags: ["conversion", "data"],
    icon: Table2,
  },
  {
    id: "image-geocoder",
    name: "Image Geocoder",
    language: "Python",
    description: "Reverse geocode GPS coordinates embedded in image EXIF data.",
    tags: ["geo", "images"],
    icon: ImageIcon,
  },
];

const LANG_STYLE: Record<string, { bg: string; color: string }> = {
  Python: { bg: "rgba(59,130,246,0.12)", color: "#3b82f6" },
  Shell: { bg: "rgba(107,114,128,0.12)", color: "var(--text-2)" },
  JS: { bg: "rgba(234,179,8,0.12)", color: "#ca8a04" },
};

function ScriptCard({ script }: { script: Script }) {
  const [hovered, setHovered] = useState(false);
  const lang = LANG_STYLE[script.language] ?? LANG_STYLE["Shell"];
  const Icon = script.icon;

  const handleRun = () => {
    if (script.id === "overture") {
      console.log("Would send prompt to chat: Run Overture Maps Download script");
    }
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: 14, borderRadius: 10,
        border: `0.5px solid ${hovered ? "var(--accent-border)" : "var(--border)"}`,
        background: hovered ? "var(--accent-soft)" : "var(--bg-card)",
        backdropFilter: "blur(20px)",
        display: "flex", flexDirection: "column", gap: 10,
        transition: "all 0.15s",
        cursor: "default",
      }}
    >
      {/* Top row: icon + name + lang badge */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div
          style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon size={16} color="var(--text-2)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 2 }}>{script.name}</div>
          <span
            style={{
              fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 5,
              background: lang.bg, color: lang.color,
            }}
          >
            {script.language}
          </span>
        </div>
      </div>

      {/* Description */}
      <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.5 }}>{script.description}</div>

      {/* Footer: tags + run button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 2 }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {script.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 10, padding: "1px 6px", borderRadius: 4,
                background: "var(--bg-hover)", color: "var(--text-3)", border: "0.5px solid var(--border)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
        <button
          onClick={handleRun}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 6, flexShrink: 0,
            border: "0.5px solid var(--border)", background: "var(--bg-panel)",
            color: "var(--text-1)", fontSize: 11, fontWeight: 500, cursor: "pointer",
          }}
        >
          <Play size={10} />
          Run in Chat
        </button>
      </div>
    </div>
  );
}

export function ScriptsPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>Utility Scripts</div>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Ready-to-run scripts for this workspace</div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 10,
        }}
      >
        {SCRIPTS.map((s) => (
          <ScriptCard key={s.id} script={s} />
        ))}
      </div>
    </div>
  );
}
