import {
  GraphData,
  GraphNode,
  GraphLink,
  MasteryBand,
  Topic,
  UserTopicState,
} from './types';
import { getTopicCatalog, SEED_TO_ONBOARDING_MAP } from './catalog';

/**
 * Normalizes a raw rating into a 0..1 scale.
 * If the rating is 1..5 (Clarity slider default): (val - 1) / 4
 * If already 0..1: returns value
 * If invalid or undefined: returns null
 */
export function normalizeRating(rawRating: number | null | undefined): number | null {
  if (rawRating === null || rawRating === undefined || Number.isNaN(rawRating)) {
    return null;
  }
  // If already normalized strictly between 0 and 1
  if (rawRating > 0 && rawRating < 1) {
    return Math.max(0, Math.min(1, Math.round(rawRating * 100) / 100));
  }
  if (rawRating === 0) {
    return 0;
  }
  // Slider scale 1..5: 1 -> 0, 2 -> 0.25, 3 -> 0.5, 4 -> 0.75, 5 -> 1.0
  if (rawRating >= 1 && rawRating <= 5) {
    return Math.max(0, Math.min(1, Math.round(((rawRating - 1) / 4) * 100) / 100));
  }
  // Fallback clamping
  return Math.max(0, Math.min(1, rawRating));
}

/**
 * Derives the mastery band from a 0..1 normalized score.
 * weak: < 0.4
 * developing: 0.4 - 0.7
 * strong: >= 0.7
 * unrated: null
 */
export function getMasteryBand(mastery: number | null): MasteryBand {
  if (mastery === null || mastery === undefined) {
    return 'unrated';
  }
  if (mastery < 0.4) {
    return 'weak';
  }
  if (mastery < 0.7) {
    return 'developing';
  }
  return 'strong';
}

export interface GenerateGraphOptions {
  catalog?: Topic[];
  ratings?: Record<string, number | null | undefined> | UserTopicState[];
  targetCompany?: string;
  timeline?: string;
}

/**
 * Deterministically generates a personal knowledge graph from a topic catalog
 * and user rating states.
 */
export function generateKnowledgeGraph(options: GenerateGraphOptions = {}): GraphData {
  const catalog = options.catalog && options.catalog.length > 0
    ? options.catalog
    : getTopicCatalog('onboarding');

  // Convert ratings into a normalized lookup map
  const ratingMap = new Map<string, { mastery: number | null; lastRevisedAt?: string; quizMistakes?: number }>();

  if (options.ratings) {
    if (Array.isArray(options.ratings)) {
      for (const item of options.ratings) {
        ratingMap.set(item.topicId, {
          mastery: normalizeRating(item.rating),
          lastRevisedAt: item.lastRevisedAt,
          quizMistakes: item.quizMistakes,
        });
      }
    } else {
      for (const [key, val] of Object.entries(options.ratings)) {
        ratingMap.set(key, {
          mastery: normalizeRating(val),
        });
      }
    }
  }

  // Helper to resolve topic ID (checks direct match, then seed reconciliation)
  const getRatingForId = (id: string) => {
    if (ratingMap.has(id)) return ratingMap.get(id);
    const mapped = SEED_TO_ONBOARDING_MAP[id];
    if (mapped && ratingMap.has(mapped)) return ratingMap.get(mapped);
    // Reverse check
    for (const [seedId, onbId] of Object.entries(SEED_TO_ONBOARDING_MAP)) {
      if (onbId === id && ratingMap.has(seedId)) {
        return ratingMap.get(seedId);
      }
    }
    return undefined;
  };

  // Build node lookup map
  const nodeMap = new Map<string, GraphNode>();

  for (const topic of catalog) {
    const userState = getRatingForId(topic.id);
    const mastery = userState ? userState.mastery : null;
    const band = getMasteryBand(mastery);

    const node: GraphNode = {
      id: topic.id,
      label: topic.label,
      subject: topic.subject,
      mastery,
      band,
      degree: 0,
      lastRevisedAt: userState?.lastRevisedAt,
      quizMistakes: userState?.quizMistakes ?? 0,
      whyItMatters: topic.description,
    };

    nodeMap.set(topic.id, node);
  }

  // Generate deduplicated, valid links (no self links, no dangling edges)
  const links: GraphLink[] = [];
  const linkKeySet = new Set<string>();

  for (const topic of catalog) {
    // 1. Prerequisites (prerequisite -> dependent)
    for (const prereqId of topic.prerequisites) {
      if (prereqId === topic.id) continue; // No self-links
      if (!nodeMap.has(prereqId) || !nodeMap.has(topic.id)) continue; // No dangling edges

      const key = `${prereqId}->${topic.id}:prereq`;
      if (linkKeySet.has(key)) continue;
      linkKeySet.add(key);

      const prereqNode = nodeMap.get(prereqId)!;
      const dependentNode = nodeMap.get(topic.id)!;

      // blocked: prerequisite is weak AND dependent topic is not weak
      const blocked = prereqNode.band === 'weak' && dependentNode.band !== 'weak';

      links.push({
        source: prereqId,
        target: topic.id,
        kind: 'prerequisite',
        blocked,
      });
    }

    // 2. Related links (undirected, deduplicated)
    for (const relatedId of topic.related) {
      if (relatedId === topic.id) continue; // No self-links
      if (!nodeMap.has(relatedId) || !nodeMap.has(topic.id)) continue; // No dangling edges

      const sortedPair = [topic.id, relatedId].sort();
      const key = `${sortedPair[0]}~${sortedPair[1]}:related`;
      if (linkKeySet.has(key)) continue;
      linkKeySet.add(key);

      links.push({
        source: topic.id,
        target: relatedId,
        kind: 'related',
        blocked: false,
      });
    }
  }

  // Compute undirected degree per node
  for (const link of links) {
    const srcId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
    const tgtId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;

    const srcNode = nodeMap.get(srcId);
    if (srcNode) srcNode.degree += 1;

    const tgtNode = nodeMap.get(tgtId);
    if (tgtNode) tgtNode.degree += 1;
  }

  const nodes = Array.from(nodeMap.values());

  return {
    nodes,
    links,
    meta: {
      targetCompany: options.targetCompany || 'Target Company',
      timeline: options.timeline || 'Upcoming Placement',
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Updates a node's fields in place without breaking object references
 * or restarting the simulation, as mandated by the spec.
 */
export function updateNodeInPlace(
  graphData: GraphData,
  topicId: string,
  updates: { rating?: number | null; lastRevisedAt?: string; quizMistakes?: number; whyItMatters?: string }
): GraphData {
  const node = graphData.nodes.find((n) => n.id === topicId);
  if (!node) return graphData;

  if (updates.rating !== undefined) {
    node.mastery = normalizeRating(updates.rating);
    node.band = getMasteryBand(node.mastery);
  }
  if (updates.lastRevisedAt !== undefined) {
    node.lastRevisedAt = updates.lastRevisedAt;
  }
  if (updates.quizMistakes !== undefined) {
    node.quizMistakes = updates.quizMistakes;
  }
  if (updates.whyItMatters !== undefined) {
    node.whyItMatters = updates.whyItMatters;
  }

  // Recompute blocked state on affected prerequisite links
  for (const link of graphData.links) {
    if (link.kind !== 'prerequisite') continue;

    const srcId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
    const tgtId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;

    if (srcId === topicId || tgtId === topicId) {
      const srcNode = graphData.nodes.find((n) => n.id === srcId);
      const tgtNode = graphData.nodes.find((n) => n.id === tgtId);

      if (srcNode && tgtNode) {
        link.blocked = srcNode.band === 'weak' && tgtNode.band !== 'weak';
      }
    }
  }

  return graphData;
}
