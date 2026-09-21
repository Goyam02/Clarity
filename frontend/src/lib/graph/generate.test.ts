import { describe, it, expect } from 'vitest';
import {
  generateKnowledgeGraph,
  getMasteryBand,
  normalizeRating,
  updateNodeInPlace,
} from './generate';
import { ONBOARDING_TOPIC_CATALOG, SEED_CATALOG } from './catalog';
import { GraphNode } from './types';

describe('Knowledge Graph Generation (generate.ts)', () => {
  // 1. Node count
  it('generates exactly one node per catalog topic for onboarding catalog', () => {
    const graph = generateKnowledgeGraph({ catalog: ONBOARDING_TOPIC_CATALOG });
    expect(graph.nodes.length).toBe(ONBOARDING_TOPIC_CATALOG.length);

    const catalogIds = new Set(ONBOARDING_TOPIC_CATALOG.map((t) => t.id));
    for (const node of graph.nodes) {
      expect(catalogIds.has(node.id)).toBe(true);
    }
  });

  it('generates exactly one node per catalog topic for seed catalog fallback', () => {
    const graph = generateKnowledgeGraph({ catalog: SEED_CATALOG });
    expect(graph.nodes.length).toBe(SEED_CATALOG.length);
  });

  // 2. No dangling edges & No self links
  it('contains zero dangling edges and zero self-links', () => {
    const graph = generateKnowledgeGraph({ catalog: ONBOARDING_TOPIC_CATALOG });
    const nodeIds = new Set(graph.nodes.map((n) => n.id));

    expect(graph.links.length).toBeGreaterThan(0);

    for (const link of graph.links) {
      const srcId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
      const tgtId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;

      // No self links
      expect(srcId).not.toBe(tgtId);

      // No dangling edges
      expect(nodeIds.has(srcId)).toBe(true);
      expect(nodeIds.has(tgtId)).toBe(true);
    }
  });

  it('contains zero dangling edges in the seed catalog', () => {
    const graph = generateKnowledgeGraph({ catalog: SEED_CATALOG });
    const nodeIds = new Set(graph.nodes.map((n) => n.id));

    for (const link of graph.links) {
      const srcId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
      const tgtId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;

      expect(srcId).not.toBe(tgtId);
      expect(nodeIds.has(srcId)).toBe(true);
      expect(nodeIds.has(tgtId)).toBe(true);
    }
  });

  // 3. Degree correctness (undirected)
  it('computes accurate undirected degree for each node', () => {
    const graph = generateKnowledgeGraph({ catalog: ONBOARDING_TOPIC_CATALOG });
    const counts = new Map<string, number>();

    for (const node of graph.nodes) {
      counts.set(node.id, 0);
    }

    for (const link of graph.links) {
      const srcId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
      const tgtId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;

      counts.set(srcId, (counts.get(srcId) || 0) + 1);
      counts.set(tgtId, (counts.get(tgtId) || 0) + 1);
    }

    for (const node of graph.nodes) {
      expect(node.degree).toBe(counts.get(node.id));
    }
  });

  // 4. Band thresholds
  it('evaluates mastery bands according to exact threshold specifications', () => {
    expect(getMasteryBand(null)).toBe('unrated');
    expect(getMasteryBand(undefined as any)).toBe('unrated');

    // weak < 0.4
    expect(getMasteryBand(0)).toBe('weak');
    expect(getMasteryBand(0.25)).toBe('weak');
    expect(getMasteryBand(0.39)).toBe('weak');

    // developing 0.4 .. 0.7
    expect(getMasteryBand(0.4)).toBe('developing');
    expect(getMasteryBand(0.5)).toBe('developing');
    expect(getMasteryBand(0.69)).toBe('developing');

    // strong >= 0.7
    expect(getMasteryBand(0.7)).toBe('strong');
    expect(getMasteryBand(0.85)).toBe('strong');
    expect(getMasteryBand(1.0)).toBe('strong');
  });

  it('normalizes 1..5 slider ratings correctly to 0..1 scale', () => {
    expect(normalizeRating(1)).toBe(0);
    expect(normalizeRating(3)).toBe(0.5);
    expect(normalizeRating(5)).toBe(1.0);
    expect(normalizeRating(null)).toBeNull();
  });

  // 5. Blocked-link logic
  it('marks prerequisite link as blocked when prerequisite is weak and dependent is not weak', () => {
    // arrays_strings is prerequisite to binary_search
    // Case 1: arrays_strings is weak (1), binary_search is developing (3) -> blocked should be true
    const graph1 = generateKnowledgeGraph({
      catalog: ONBOARDING_TOPIC_CATALOG,
      ratings: {
        arrays_strings: 1, // weak (0.0)
        binary_search: 3, // developing (0.5)
      },
    });

    const prereqLink1 = graph1.links.find(
      (l) => l.kind === 'prerequisite' && l.source === 'arrays_strings' && l.target === 'binary_search'
    );
    expect(prereqLink1).toBeDefined();
    expect(prereqLink1?.blocked).toBe(true);

    // Case 2: Both prerequisite and dependent are weak -> blocked should be false
    const graph2 = generateKnowledgeGraph({
      catalog: ONBOARDING_TOPIC_CATALOG,
      ratings: {
        arrays_strings: 1, // weak
        binary_search: 1, // weak
      },
    });
    const prereqLink2 = graph2.links.find(
      (l) => l.kind === 'prerequisite' && l.source === 'arrays_strings' && l.target === 'binary_search'
    );
    expect(prereqLink2?.blocked).toBe(false);

    // Case 3: Prerequisite is strong, dependent is developing -> blocked should be false
    const graph3 = generateKnowledgeGraph({
      catalog: ONBOARDING_TOPIC_CATALOG,
      ratings: {
        arrays_strings: 5, // strong
        binary_search: 3, // developing
      },
    });
    const prereqLink3 = graph3.links.find(
      (l) => l.kind === 'prerequisite' && l.source === 'arrays_strings' && l.target === 'binary_search'
    );
    expect(prereqLink3?.blocked).toBe(false);
  });

  // 6. In-place updates without recreating structure
  it('updates node mastery in-place and recomputes blocked status without recreating objects', () => {
    const graph = generateKnowledgeGraph({
      catalog: ONBOARDING_TOPIC_CATALOG,
      ratings: {
        arrays_strings: 1, // weak
        binary_search: 4, // strong -> link blocked
      },
    });

    const link = graph.links.find(
      (l) => l.kind === 'prerequisite' && l.source === 'arrays_strings' && l.target === 'binary_search'
    );
    expect(link?.blocked).toBe(true);

    // Update arrays_strings to 5 (strong)
    updateNodeInPlace(graph, 'arrays_strings', { rating: 5 });

    const updatedNode = graph.nodes.find((n) => n.id === 'arrays_strings');
    expect(updatedNode?.band).toBe('strong');
    expect(updatedNode?.mastery).toBe(1.0);

    // Blocked link should now be false
    expect(link?.blocked).toBe(false);
  });
});
