import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "../radar-map.css";
type Point = {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  digitalStatus: string;
  opportunityScore: number;
};
export function OpportunityMap({
  items,
  selectedId,
  onSelect,
}: {
  items: Point[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap>();
  useEffect(() => {
    if (!node.current) return;
    const instance = new maplibregl.Map({
      container: node.current,
      center: [-51.9, -14.2],
      zoom: 4,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
    });
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl(), "top-right");
    instance.on("load", () => {
      instance.addSource("opportunities", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 48,
      });
      instance.addLayer({
        id: "clusters",
        type: "circle",
        source: "opportunities",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#5ca477",
          "circle-radius": [
            "step",
            ["get", "point_count"],
            18,
            20,
            24,
            100,
            30,
          ],
          "circle-stroke-color": "#07120c",
          "circle-stroke-width": 2,
        },
      });
      instance.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "opportunities",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
        },
        paint: { "text-color": "#07120c" },
      });
      instance.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "opportunities",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "match",
            ["get", "digitalStatus"],
            "NO_WEBSITE_FOUND",
            "#79bf8d",
            "SOCIAL_ONLY",
            "#c6a36a",
            "HAS_WEBSITE",
            "#87928b",
            "#9daaa2",
          ],
          "circle-radius": 8,
          "circle-stroke-color": "#07120c",
          "circle-stroke-width": 2,
        },
      });
      instance.on("click", "unclustered-point", (event) => {
        const feature = event.features?.[0];
        const id = feature?.properties?.id;
        if (id) {
          onSelect(id);
          const point = feature.geometry as GeoJSON.Point;
          new maplibregl.Popup({ closeButton: true, closeOnClick: true })
            .setLngLat(point.coordinates as [number, number])
            .setText(
              `${feature.properties?.name || "Oportunidade"} · Score ${feature.properties?.opportunityScore || 0}`,
            )
            .addTo(instance);
        }
      });
      instance.on("click", "clusters", (event) => {
        const feature = instance.queryRenderedFeatures(event.point, {
          layers: ["clusters"],
        })[0];
        const clusterId = feature.properties?.cluster_id;
        (
          instance.getSource("opportunities") as maplibregl.GeoJSONSource
        ).getClusterExpansionZoom(clusterId, (error, zoom) => {
          if (!error)
            instance.easeTo({
              center: (feature.geometry as GeoJSON.Point).coordinates as [
                number,
                number,
              ],
              zoom,
            });
        });
      });
    });
    return () => {
      instance.remove();
      map.current = undefined;
    };
  }, [onSelect]);
  useEffect(() => {
    const instance = map.current;
    if (!instance || !instance.isStyleLoaded()) return;
    const features = items
      .filter((item) => item.latitude && item.longitude)
      .map((item) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [item.longitude!, item.latitude!],
        },
        properties: {
          id: item.id,
          name: item.name,
          digitalStatus: item.digitalStatus,
          opportunityScore: item.opportunityScore,
        },
      }));
    const source = instance.getSource("opportunities") as
      maplibregl.GeoJSONSource | undefined;
    source?.setData({
      type: "FeatureCollection",
      features,
    } as GeoJSON.FeatureCollection);
    if (features.length) {
      const bounds = new maplibregl.LngLatBounds();
      features.forEach((feature) =>
        bounds.extend(feature.geometry.coordinates as [number, number]),
      );
      instance.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    }
  }, [items]);
  useEffect(() => {
    const item = items.find((value) => value.id === selectedId);
    if (item?.longitude && item.latitude)
      map.current?.flyTo({
        center: [item.longitude, item.latitude],
        zoom: 15,
        duration: 500,
      });
  }, [selectedId, items]);
  return (
    <div
      ref={node}
      className="real-map"
      aria-label="Mapa real de oportunidades"
    />
  );
}
