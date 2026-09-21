import React, {
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { forceX, forceY, forceCollide } from 'd3-force';
import {
  GraphData,
  GraphNode,
  GraphLink,
  GraphSettings,
  DEFAULT_GRAPH_SETTINGS,
  MasteryBand,
} from '../../lib/graph/types';
import { GraphControls } from './GraphControls';
import { TopicPanel } from './TopicPanel';
import { updateNodeInPlace } from '../../lib/graph/generate';
import { useGraphTheme, getBandFillColor } from '../../lib/graph/graphTheme';

export interface KnowledgeGraphProps {
  initialData: GraphData;
  highlightedNodeId?: string | null;
  onNodeSelect?: (node: GraphNode | null) => void;
  onActionClick?: (action: 'revision' | 'practice' | 'quiz', node: GraphNode) => void;
  className?: string;
  autoplayAnimation?: boolean;
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  initialData,
  highlightedNodeId = null,
  onNodeSelect,
  onActionClick,
  className = '',
  autoplayAnimation = false,
}) => {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Read theme tokens via shared hook
  const theme = useGraphTheme();

  // Local graph data state (allows in-place updates)
  const [graphData, setGraphData] = useState<GraphData>(initialData);
  const [settings, setSettings] = useState<GraphSettings>(DEFAULT_GRAPH_SETTINGS);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Animation state (BFS progressive reveal)
  const [isAnimating, setIsAnimating] = useState(false);
  const [revealedNodeIds, setRevealedNodeIds] = useState<Set<string> | null>(null);

  // Smooth hover alpha transition
  const hoverTransitionRef = useRef<{ currentAlpha: number; targetAlpha: number }>({
    currentAlpha: 1,
    targetAlpha: 1,
  });


  // Responsive container observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: Math.floor(entry.contentRect.width),
          height: Math.floor(entry.contentRect.height),
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute node radius based on degree
  const getNodeRadius = useCallback(
    (node: GraphNode, scaleMultiplier: number = settings.nodeSize) => {
      const degree = node.degree || 0;
      return scaleMultiplier * (3 + 1.3 * Math.sqrt(degree));
    },
    [settings.nodeSize]
  );

  // Compute neighbor lookups for hover/selection
  const neighborsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const link of graphData.links) {
      const srcId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
      const tgtId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;

      if (!map.has(srcId)) map.set(srcId, new Set());
      if (!map.has(tgtId)) map.set(tgtId, new Set());

      map.get(srcId)!.add(tgtId);
      map.get(tgtId)!.add(srcId);
    }
    return map;
  }, [graphData.links]);

  // Local graph BFS filter (up to N hops from selected node)
  const localGraphNodeIds = useMemo(() => {
    if (settings.mode !== 'local' || !selectedNodeId) return null;
    const visited = new Set<string>([selectedNodeId]);
    let currentQueue = [selectedNodeId];

    for (let depth = 0; depth < settings.localDepth; depth++) {
      const nextQueue: string[] = [];
      for (const id of currentQueue) {
        const neighbors = neighborsMap.get(id);
        if (neighbors) {
          for (const nId of neighbors) {
            if (!visited.has(nId)) {
              visited.add(nId);
              nextQueue.push(nId);
            }
          }
        }
      }
      currentQueue = nextQueue;
    }
    return visited;
  }, [settings.mode, selectedNodeId, settings.localDepth, neighborsMap]);

  // Filtered graph data according to settings
  const filteredData = useMemo(() => {
    const query = settings.searchQuery.trim().toLowerCase();

    // 1. Filter nodes
    let nodes = graphData.nodes.filter((node) => {
      if (localGraphNodeIds && !localGraphNodeIds.has(node.id)) {
        return false;
      }
      if (query && !node.label.toLowerCase().includes(query) && !node.id.toLowerCase().includes(query)) {
        return false;
      }
      if (!settings.selectedSubjects.includes(node.subject)) {
        return false;
      }
      if (!settings.selectedBands.includes(node.band)) {
        return false;
      }
      return true;
    });

    const activeNodeIds = new Set(nodes.map((n) => n.id));

    // 2. Filter links (both endpoints must be active)
    const links = graphData.links.filter((link) => {
      const srcId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
      const tgtId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;

      if (!activeNodeIds.has(srcId) || !activeNodeIds.has(tgtId)) {
        return false;
      }

      // During animation, link appears only when both endpoints are revealed
      if (revealedNodeIds && (!revealedNodeIds.has(srcId) || !revealedNodeIds.has(tgtId))) {
        return false;
      }

      return true;
    });

    // 3. Orphans filter
    if (!settings.showOrphans) {
      const connectedIds = new Set<string>();
      for (const l of links) {
        connectedIds.add(typeof l.source === 'string' ? l.source : (l.source as GraphNode).id);
        connectedIds.add(typeof l.target === 'string' ? l.target : (l.target as GraphNode).id);
      }
      nodes = nodes.filter((n) => connectedIds.has(n.id));
    }

    // If animation is running, filter nodes to revealed
    if (revealedNodeIds) {
      nodes = nodes.filter((n) => revealedNodeIds.has(n.id));
    }

    return { nodes, links };
  }, [graphData, settings, localGraphNodeIds, revealedNodeIds]);

  // Tune D3 forces according to settings
  useEffect(() => {
    if (!fgRef.current) return;

    try {
      // Repel (charge)
      const charge = fgRef.current.d3Force('charge');
      if (charge) {
        charge.strength(settings.chargeRepel);
      }

      // Link force and distance
      const link = fgRef.current.d3Force('link');
      if (link) {
        link.distance(settings.linkDistance).strength(settings.linkStrength);
      }

      // Center pull forces
      fgRef.current.d3Force('x', forceX().strength(settings.centerStrength));
      fgRef.current.d3Force('y', forceY().strength(settings.centerStrength));

      // Collide force
      fgRef.current.d3Force(
        'collide',
        forceCollide((node: any) => getNodeRadius(node as GraphNode, settings.nodeSize) + 3)
      );

      // Reheat simulation so changes settle organically
      fgRef.current.d3ReheatSimulation();
    } catch {
      // ignore
    }
  }, [
    settings.chargeRepel,
    settings.linkDistance,
    settings.linkStrength,
    settings.centerStrength,
    settings.nodeSize,
    getNodeRadius,
  ]);

  // Initial fit to view once layout settles
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(400, 48);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  // BFS Growth Animation
  const triggerBfsAnimation = useCallback(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return;

    setIsAnimating(true);

    // Find root: node with highest degree
    const sorted = [...graphData.nodes].sort((a, b) => (b.degree || 0) - (a.degree || 0));
    const root = sorted[0];
    if (!root) {
      setIsAnimating(false);
      return;
    }

    // BFS ordering
    const order: string[] = [root.id];
    const visited = new Set<string>([root.id]);
    const queue: string[] = [root.id];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const neighbors = neighborsMap.get(curr);
      if (neighbors) {
        for (const nId of neighbors) {
          if (!visited.has(nId)) {
            visited.add(nId);
            order.push(nId);
            queue.push(nId);
          }
        }
      }
    }

    // Add any remaining unconnected nodes
    for (const node of graphData.nodes) {
      if (!visited.has(node.id)) {
        order.push(node.id);
        visited.add(node.id);
      }
    }

    // Reveal progressively over ~3 seconds
    const totalDuration = 3000;
    const stepInterval = Math.max(25, Math.floor(totalDuration / order.length));
    let step = 0;

    const revealed = new Set<string>();
    setRevealedNodeIds(new Set());

    const interval = setInterval(() => {
      step++;
      const currentId = order[step - 1];
      if (currentId) {
        revealed.add(currentId);
        setRevealedNodeIds(new Set(revealed));
      }

      if (step >= order.length) {
        clearInterval(interval);
        setTimeout(() => {
          setRevealedNodeIds(null); // Return to full view
          setIsAnimating(false);
          if (fgRef.current) {
            fgRef.current.d3ReheatSimulation();
          }
        }, 400);
      }
    }, stepInterval);
  }, [graphData.nodes, neighborsMap]);

  // Autoplay animation on first load after onboarding if requested
  useEffect(() => {
    if (!autoplayAnimation || typeof window === 'undefined') return;
    const alreadyAnimated = sessionStorage.getItem('clarity_graph_animated');
    if (!alreadyAnimated) {
      sessionStorage.setItem('clarity_graph_animated', 'true');
      const timer = setTimeout(() => {
        triggerBfsAnimation();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [autoplayAnimation, triggerBfsAnimation]);

  // Node selection handler
  const handleNodeClick = useCallback(
    (node: any) => {
      const graphNode = node as GraphNode;
      if (!graphNode) return;
      const nextId = selectedNodeId === graphNode.id ? null : graphNode.id;
      setSelectedNodeId(nextId);
      onNodeSelect?.(nextId ? graphNode : null);

      if (nextId && fgRef.current && graphNode.x !== undefined && graphNode.y !== undefined) {
        fgRef.current.centerAt(graphNode.x, graphNode.y, 400);
      }
    },
    [selectedNodeId, onNodeSelect]
  );

  // Center on node by ID (from TopicPanel chip clicks)
  const handleCenterOnNodeId = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      const targetNode = graphData.nodes.find((n) => n.id === nodeId);
      if (targetNode) {
        onNodeSelect?.(targetNode);
        if (fgRef.current && targetNode.x !== undefined && targetNode.y !== undefined) {
          fgRef.current.centerAt(targetNode.x, targetNode.y, 500);
        }
      }
    },
    [graphData.nodes, onNodeSelect]
  );

  // In-place node rating update
  const handleUpdateRating = useCallback(
    (nodeId: string, rating: number) => {
      setGraphData((prev) => {
        const next = updateNodeInPlace(prev, nodeId, { rating });
        // Trigger visual redraw without re-layout
        return { ...next, nodes: [...next.nodes], links: [...next.links] };
      });
    },
    []
  );

  // Drag handlers (pin node and reheat simulation)
  const handleNodeDrag = useCallback((node: any) => {
    node.fx = node.x;
    node.fy = node.y;
    if (fgRef.current) {
      fgRef.current.d3ReheatSimulation();
    }
  }, []);

  const handleNodeDragEnd = useCallback((node: any) => {
    node.fx = null;
    node.fy = null;
  }, []);

  // Node Canvas Painter (draws circle fill, halo outline, and selected ring)
  const drawNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const graphNode = node as GraphNode;
      const isHovered = hoveredNodeId === graphNode.id;
      const isSelected = selectedNodeId === graphNode.id;
      const isExternallyHighlighted = highlightedNodeId === graphNode.id;
      const isNeighborOfHovered =
        hoveredNodeId !== null &&
        neighborsMap.get(hoveredNodeId)?.has(graphNode.id);

      // Light theme tuned hover dimming: non-neighbors drop to 0.15 alpha
      let alpha = 1.0;
      if (hoveredNodeId) {
        alpha = isHovered || isNeighborOfHovered ? 1.0 : 0.15;
      }

      const radius = getNodeRadius(graphNode, settings.nodeSize);

      ctx.save();
      ctx.globalAlpha = alpha;

      // 1. Fill Circle based on Mastery Band
      const nodeColor = getBandFillColor(graphNode.band, theme);
      ctx.beginPath();
      ctx.arc(graphNode.x || 0, graphNode.y || 0, radius, 0, 2 * Math.PI, false);
      ctx.fillStyle = nodeColor;
      ctx.fill();

      // 2. 1.5px Outline in --halo so overlapping nodes stay separable on light bg
      ctx.strokeStyle = theme.halo;
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();

      // 3. 2px Outer Ring in --ink for Selected Node (offset 3px)
      if (isSelected || isExternallyHighlighted) {
        ctx.beginPath();
        ctx.arc(
          graphNode.x || 0,
          graphNode.y || 0,
          radius + 3 / globalScale,
          0,
          2 * Math.PI,
          false
        );
        ctx.strokeStyle = theme.ink;
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      ctx.restore();
    },
    [
      hoveredNodeId,
      selectedNodeId,
      highlightedNodeId,
      neighborsMap,
      getNodeRadius,
      settings.nodeSize,
      theme,
    ]
  );

  // Link Canvas Painter
  const drawLink = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const graphLink = link as GraphLink;
      const src = graphLink.source as GraphNode;
      const tgt = graphLink.target as GraphNode;
      if (src.x === undefined || src.y === undefined || tgt.x === undefined || tgt.y === undefined) return;

      const isHoveredLink =
        hoveredNodeId && (src.id === hoveredNodeId || tgt.id === hoveredNodeId);
      const isSelectedLink =
        selectedNodeId && (src.id === selectedNodeId || tgt.id === selectedNodeId);
      const isDimmed = hoveredNodeId && !isHoveredLink;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);

      // Blocked prerequisite links: --mastery-weak-fill, 2px, dashed [6,4]
      if (graphLink.blocked) {
        ctx.setLineDash([6 / globalScale, 4 / globalScale]);
        ctx.strokeStyle = theme.masteryWeakFill;
        ctx.globalAlpha = isDimmed ? 0.2 : 0.95;
        ctx.lineWidth = (2.0 * settings.linkThickness) / Math.max(1, globalScale * 0.4);
      } else if (isHoveredLink || isSelectedLink) {
        ctx.setLineDash([]);
        ctx.strokeStyle = theme.ink;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = (1.6 * settings.linkThickness) / Math.max(1, globalScale * 0.4);
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = theme.link;
        ctx.globalAlpha = isDimmed ? 0.15 : 1.0;
        ctx.lineWidth = (1.0 * settings.linkThickness) / Math.max(1, globalScale * 0.4);
      }
      ctx.stroke();

      // Optional arrowheads
      if (settings.showArrows && graphLink.kind === 'prerequisite') {
        const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
        const tgtRadius = getNodeRadius(tgt, settings.nodeSize);
        const arrowX = tgt.x - tgtRadius * Math.cos(angle);
        const arrowY = tgt.y - tgtRadius * Math.sin(angle);
        const headLen = 6 / globalScale;

        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - headLen * Math.cos(angle - Math.PI / 6),
          arrowY - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          arrowX - headLen * Math.cos(angle + Math.PI / 6),
          arrowY - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      }

      ctx.setLineDash([]);
      ctx.restore();
    },
    [
      hoveredNodeId,
      selectedNodeId,
      settings.linkThickness,
      settings.showArrows,
      settings.nodeSize,
      getNodeRadius,
      theme,
    ]
  );

  // Post-render label drawing pass (labels never covered by nodes; greedy collision culling)
  const drawPostFrameLabels = useCallback(
    (ctx: CanvasRenderingContext2D, globalScale: number) => {
      const nodes = filteredData.nodes;
      if (!nodes || nodes.length === 0) return;

      // Identify blocked flow nodes to boost their priority
      const blockedNodeIds = new Set<string>();
      for (const link of filteredData.links) {
        if (link.blocked) {
          const srcId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
          const tgtId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
          blockedNodeIds.add(srcId);
          blockedNodeIds.add(tgtId);
        }
      }

      // Priority ranking: hovered/selected/highlighted > neighbors > weak/blocked > higher degree > rest
      const getNodePriority = (node: GraphNode): number => {
        const isFocal =
          node.id === hoveredNodeId ||
          node.id === selectedNodeId ||
          node.id === highlightedNodeId;
        if (isFocal) return 10000;

        const isNeighbor =
          hoveredNodeId !== null &&
          neighborsMap.get(hoveredNodeId)?.has(node.id);
        if (isNeighbor) return 5000;

        if (blockedNodeIds.has(node.id) || node.band === 'weak') {
          return 2000 + (node.degree || 0);
        }

        return node.degree || 0;
      };

      const sortedNodes = [...nodes].sort((a, b) => getNodePriority(b) - getNodePriority(a));

      // Font: Dashboard sans, 12px in screen space, weight 500
      const fontSize = 12 / globalScale;
      ctx.font = `500 ${fontSize}px 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      interface BoundingBox {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
      }

      const drawnBoxes: BoundingBox[] = [];

      const checkOverlap = (a: BoundingBox, b: BoundingBox) =>
        !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);

      for (const node of sortedNodes) {
        if (node.x === undefined || node.y === undefined) continue;

        const isFocal =
          node.id === hoveredNodeId ||
          node.id === selectedNodeId ||
          node.id === highlightedNodeId;

        const isNeighbor =
          hoveredNodeId !== null &&
          neighborsMap.get(hoveredNodeId)?.has(node.id);

        // Keep existing text-fade-threshold setting working for non-focal/non-neighbor labels
        if (!isFocal && !isNeighbor && globalScale < settings.fadeThreshold) {
          continue;
        }

        const radius = getNodeRadius(node, settings.nodeSize);
        const textX = node.x;
        const textY = node.y + radius + 4 / globalScale;

        const metrics = ctx.measureText(node.label);
        const textWidth = metrics.width;
        const textHeight = 13 / globalScale;
        const padX = 2 / globalScale;
        const padY = 2 / globalScale;

        const box: BoundingBox = {
          minX: textX - textWidth / 2 - padX,
          maxX: textX + textWidth / 2 + padX,
          minY: textY - padY,
          maxY: textY + textHeight + padY,
        };

        // Collision culling: non-focal labels that overlap an existing label are skipped
        if (!isFocal) {
          let hasCollision = false;
          for (const drawn of drawnBoxes) {
            if (checkOverlap(box, drawn)) {
              hasCollision = true;
              break;
            }
          }
          if (hasCollision) {
            continue; // Skipped label appears as user zooms in
          }
        }

        drawnBoxes.push(box);

        ctx.save();
        // Hover alpha dimming for non-neighbors
        if (hoveredNodeId && !isFocal && !isNeighbor) {
          ctx.globalAlpha = 0.15;
        } else {
          ctx.globalAlpha = 1.0;
        }

        // 1. Draw stroke first in --halo (lineWidth 3/globalScale, lineJoin round)
        ctx.strokeStyle = theme.halo;
        ctx.lineWidth = 3 / globalScale;
        ctx.lineJoin = 'round';
        ctx.strokeText(node.label, textX, textY);

        // 2. Draw fill in --ink
        ctx.fillStyle = theme.ink;
        ctx.fillText(node.label, textX, textY);

        ctx.restore();
      }
    },
    [
      filteredData,
      hoveredNodeId,
      selectedNodeId,
      highlightedNodeId,
      neighborsMap,
      settings.fadeThreshold,
      settings.nodeSize,
      getNodeRadius,
      theme,
    ]
  );

  // Selected node object for TopicPanel
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return graphData.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, graphData.nodes]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-[500px] overflow-hidden select-none bg-transparent ${className}`}
    >
      {/* 2D Canvas Force Graph */}
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={filteredData}
        nodeId="id"
        backgroundColor="rgba(0,0,0,0)"
        nodeCanvasObject={drawNode}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          const radius = getNodeRadius(node as GraphNode, settings.nodeSize);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x || 0, node.y || 0, radius + 5, 0, 2 * Math.PI, false);
          ctx.fill();
        }}
        linkCanvasObject={drawLink}
        onRenderFramePost={drawPostFrameLabels}
        onNodeHover={(node: any) => setHoveredNodeId(node ? (node as GraphNode).id : null)}
        onNodeClick={handleNodeClick}
        onBackgroundClick={() => {
          setSelectedNodeId(null);
          onNodeSelect?.(null);
        }}
        onNodeDrag={handleNodeDrag}
        onNodeDragEnd={handleNodeDragEnd}
        enableNodeDrag={true}
        autoPauseRedraw={false}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.35}
        cooldownTime={15000}
        minZoom={0.2}
        maxZoom={8}
      />

      {/* Obsidian-Style Settings Panel (Top Right) */}
      <GraphControls
        settings={settings}
        onUpdateSettings={(updates) => setSettings((prev) => ({ ...prev, ...updates }))}
        onResetSettings={() => setSettings(DEFAULT_GRAPH_SETTINGS)}
        onTriggerAnimate={triggerBfsAnimation}
        isAnimating={isAnimating}
        nodes={graphData.nodes}
        selectedNodeId={selectedNodeId}
      />

      {/* Selected Topic Details Panel (Bottom Left / Overlay) */}
      <TopicPanel
        node={selectedNode}
        onClose={() => {
          setSelectedNodeId(null);
          onNodeSelect?.(null);
        }}
        allNodes={graphData.nodes}
        links={graphData.links}
        onSelectNode={handleCenterOnNodeId}
        onUpdateRating={handleUpdateRating}
        onActionClick={onActionClick}
      />

      {/* Quick Viewport Reset Toolbar (Bottom Right) */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 z-20 bg-[var(--surface)] border border-[var(--border)] p-1 rounded-[8px] text-[11px] font-mono text-[var(--ink)] shadow-[0_4px_20px_rgba(40,35,25,0.06)] backdrop-blur-md">
        <button
          type="button"
          onClick={() => fgRef.current?.zoomToFit(400, 48)}
          className="px-2.5 py-1 rounded-[4px] hover:bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1"
          title="Fit graph to screen"
        >
          Fit View
        </button>
        <span className="text-[var(--border)]">|</span>
        <button
          type="button"
          onClick={() => {
            const currentZoom = fgRef.current?.zoom() || 1;
            fgRef.current?.zoom(currentZoom * 1.3, 250);
          }}
          className="px-2 py-1 rounded-[4px] hover:bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1"
          title="Zoom In"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => {
            const currentZoom = fgRef.current?.zoom() || 1;
            fgRef.current?.zoom(currentZoom / 1.3, 250);
          }}
          className="px-2 py-1 rounded-[4px] hover:bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-1"
          title="Zoom Out"
        >
          -
        </button>
      </div>

      {/* Screen Reader Accessibility Fallback */}
      <div className="sr-only" aria-live="polite">
        <h2>Clarity Personal Knowledge Graph Topics</h2>
        <ul>
          {graphData.nodes.map((node) => (
            <li key={node.id}>
              {node.label} ({node.subject}): Mastery {node.band}, Rating{' '}
              {node.mastery !== null ? `${Math.round(node.mastery * 100)}%` : 'unrated'}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default KnowledgeGraph;
