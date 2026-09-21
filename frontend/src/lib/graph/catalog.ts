import { Topic, Subject } from './types';
import { SKILL_CATEGORIES } from '../../onboarding/data/skillTopics';

/**
 * RECONCILE_MAP maps between Onboarding IDs and Seed Catalog IDs.
 */
export const SEED_TO_ONBOARDING_MAP: Record<string, string> = {
  arrays: 'arrays_strings',
  strings: 'arrays_strings',
  hashing: 'hash_tables',
  'two-pointers': 'two_pointers',
  'sliding-window': 'sliding_window',
  sorting: 'sorting',
  'binary-search': 'binary_search',
  recursion: 'recursion_backtracking',
  backtracking: 'recursion_backtracking',
  'linked-list': 'linked_lists',
  'stack-queue': 'stacks',
  trees: 'trees',
  bst: 'trees',
  heaps: 'heaps',
  tries: 'tries',
  graphs: 'graphs',
  dp: 'dynamic_programming',
  greedy: 'greedy',
  'bit-manipulation': 'bit_manipulation',
  'sql-basics': 'sql_queries',
  'sql-joins': 'sql_queries',
  'sql-aggregation': 'sql_queries',
  'sql-subqueries': 'sql_queries',
  'sql-window-functions': 'sql_queries',
  'dbms-normalization': 'dbms_fundamentals',
  'dbms-transactions': 'dbms_fundamentals',
  'dbms-indexing': 'dbms_fundamentals',
  'dbms-concurrency': 'dbms_fundamentals',
  'os-processes-threads': 'operating_systems',
  'os-scheduling': 'operating_systems',
  'os-sync': 'operating_systems',
  'os-deadlocks': 'operating_systems',
  'os-memory': 'operating_systems',
  'os-virtual-memory': 'operating_systems',
  'cn-models': 'computer_networks',
  'cn-transport': 'computer_networks',
  'cn-http-dns': 'computer_networks',
  'cn-routing': 'computer_networks',
  'cn-congestion': 'computer_networks',
};

/**
 * Seed catalog directly matching the specification prompt.
 * Guaranteed to have zero dangling edges and accurate cross-subject links.
 */
export const SEED_CATALOG: Topic[] = [
  // DSA
  { id: 'arrays', label: 'Arrays', subject: 'DSA', prerequisites: [], related: [] },
  { id: 'strings', label: 'Strings', subject: 'DSA', prerequisites: ['arrays'], related: [] },
  { id: 'hashing', label: 'Hashing', subject: 'DSA', prerequisites: ['arrays'], related: ['dbms-indexing', 'sql-joins'] },
  { id: 'two-pointers', label: 'Two Pointers', subject: 'DSA', prerequisites: ['arrays'], related: [] },
  { id: 'sliding-window', label: 'Sliding Window', subject: 'DSA', prerequisites: ['arrays', 'two-pointers'], related: [] },
  { id: 'sorting', label: 'Sorting', subject: 'DSA', prerequisites: ['arrays'], related: [] },
  { id: 'binary-search', label: 'Binary Search', subject: 'DSA', prerequisites: ['arrays', 'sorting'], related: [] },
  { id: 'recursion', label: 'Recursion', subject: 'DSA', prerequisites: [], related: [] },
  { id: 'backtracking', label: 'Backtracking', subject: 'DSA', prerequisites: ['recursion'], related: ['dp'] },
  { id: 'linked-list', label: 'Linked List', subject: 'DSA', prerequisites: [], related: [] },
  { id: 'stack-queue', label: 'Stacks & Queues', subject: 'DSA', prerequisites: ['arrays', 'linked-list'], related: [] },
  { id: 'trees', label: 'Trees', subject: 'DSA', prerequisites: ['recursion', 'linked-list'], related: ['dbms-indexing'] },
  { id: 'bst', label: 'Binary Search Trees', subject: 'DSA', prerequisites: ['trees', 'binary-search'], related: [] },
  { id: 'heaps', label: 'Heaps & Priority Queues', subject: 'DSA', prerequisites: ['trees', 'arrays'], related: ['os-scheduling'] },
  { id: 'tries', label: 'Tries', subject: 'DSA', prerequisites: ['trees', 'strings'], related: [] },
  { id: 'graphs', label: 'Graphs', subject: 'DSA', prerequisites: ['trees', 'stack-queue'], related: ['cn-routing'] },
  { id: 'dp', label: 'Dynamic Programming', subject: 'DSA', prerequisites: ['recursion', 'arrays'], related: ['greedy', 'backtracking'] },
  { id: 'greedy', label: 'Greedy Algorithms', subject: 'DSA', prerequisites: ['sorting'], related: ['dp'] },
  { id: 'bit-manipulation', label: 'Bit Manipulation', subject: 'DSA', prerequisites: [], related: [] },

  // SQL
  { id: 'sql-basics', label: 'SQL Basics', subject: 'SQL', prerequisites: [], related: [] },
  { id: 'sql-joins', label: 'SQL Joins', subject: 'SQL', prerequisites: ['sql-basics'], related: ['hashing'] },
  { id: 'sql-aggregation', label: 'SQL Aggregations', subject: 'SQL', prerequisites: ['sql-basics'], related: [] },
  { id: 'sql-subqueries', label: 'SQL Subqueries', subject: 'SQL', prerequisites: ['sql-joins'], related: [] },
  { id: 'sql-window-functions', label: 'SQL Window Functions', subject: 'SQL', prerequisites: ['sql-aggregation', 'sql-subqueries'], related: [] },

  // DBMS
  { id: 'dbms-normalization', label: 'Database Normalization', subject: 'DBMS', prerequisites: ['sql-basics'], related: [] },
  { id: 'dbms-transactions', label: 'Transactions & ACID', subject: 'DBMS', prerequisites: ['dbms-normalization'], related: [] },
  { id: 'dbms-indexing', label: 'Database Indexing', subject: 'DBMS', prerequisites: ['dbms-normalization'], related: ['hashing', 'trees'] },
  { id: 'dbms-concurrency', label: 'Concurrency Control', subject: 'DBMS', prerequisites: ['dbms-transactions', 'os-sync'], related: [] },

  // OS
  { id: 'os-processes-threads', label: 'Processes & Threads', subject: 'OS', prerequisites: [], related: [] },
  { id: 'os-scheduling', label: 'CPU Scheduling', subject: 'OS', prerequisites: ['os-processes-threads'], related: ['heaps'] },
  { id: 'os-sync', label: 'Process Synchronization', subject: 'OS', prerequisites: ['os-processes-threads'], related: [] },
  { id: 'os-deadlocks', label: 'Deadlocks', subject: 'OS', prerequisites: ['os-sync'], related: [] },
  { id: 'os-memory', label: 'Memory Management', subject: 'OS', prerequisites: ['os-processes-threads'], related: [] },
  { id: 'os-virtual-memory', label: 'Virtual Memory & Paging', subject: 'OS', prerequisites: ['os-memory'], related: [] },

  // CN
  { id: 'cn-models', label: 'OSI & TCP/IP Models', subject: 'CN', prerequisites: [], related: [] },
  { id: 'cn-transport', label: 'Transport Layer & TCP/UDP', subject: 'CN', prerequisites: ['cn-models'], related: [] },
  { id: 'cn-http-dns', label: 'DNS & HTTP/HTTPS Protocols', subject: 'CN', prerequisites: ['cn-models'], related: [] },
  { id: 'cn-routing', label: 'IP Addressing & Routing', subject: 'CN', prerequisites: ['cn-models'], related: ['graphs'] },
  { id: 'cn-congestion', label: 'Congestion & Flow Control', subject: 'CN', prerequisites: ['cn-transport'], related: [] },
];

/**
 * Single source of truth catalog based on Clarity's Onboarding Step 2 topics.
 * Contains 31 curated topics across Data Structures, Algorithms, SQL, DBMS, OS, CN, and OOP.
 */
export const ONBOARDING_TOPIC_CATALOG: Topic[] = [
  // Data Structures
  {
    id: 'arrays_strings',
    label: 'Arrays & Strings',
    subject: 'DSA',
    prerequisites: [],
    related: ['hash_tables', 'two_pointers'],
    description: 'Prefix sums, sliding buffers, 2D matrices',
  },
  {
    id: 'linked_lists',
    label: 'Linked Lists',
    subject: 'DSA',
    prerequisites: [],
    related: ['stacks', 'queues'],
    description: 'Pointers, cycles, reversal, reordering',
  },
  {
    id: 'stacks',
    label: 'Stacks',
    subject: 'DSA',
    prerequisites: ['arrays_strings', 'linked_lists'],
    related: ['queues', 'recursion_backtracking'],
    description: 'Monotonic stack, expression parsing, parentheses',
  },
  {
    id: 'queues',
    label: 'Queues & Deques',
    subject: 'DSA',
    prerequisites: ['arrays_strings', 'linked_lists'],
    related: ['stacks', 'graph_traversal'],
    description: 'Sliding window maximum, BFS queueing',
  },
  {
    id: 'hash_tables',
    label: 'Hash Tables & Maps',
    subject: 'DSA',
    prerequisites: ['arrays_strings'],
    related: ['dbms_fundamentals', 'two_pointers', 'sql_queries'],
    description: 'Collision handling, frequency counters, custom hash',
  },
  {
    id: 'trees',
    label: 'Trees & BSTs',
    subject: 'DSA',
    prerequisites: ['recursion_backtracking', 'linked_lists'],
    related: ['heaps', 'tries', 'graphs', 'dbms_fundamentals'],
    description: 'LCA, diameter, AVL/balanced trees, traversals',
  },
  {
    id: 'heaps',
    label: 'Heaps & Priority Queues',
    subject: 'DSA',
    prerequisites: ['trees', 'arrays_strings'],
    related: ['operating_systems', 'greedy', 'sorting'],
    description: 'Min/max heaps, top-K elements, median tracking',
  },
  {
    id: 'tries',
    label: 'Tries (Prefix Trees)',
    subject: 'DSA',
    prerequisites: ['trees', 'arrays_strings'],
    related: ['hash_tables'],
    description: 'Prefix searches, auto-complete, XOR maximum',
  },
  {
    id: 'graphs',
    label: 'Graphs (Basics)',
    subject: 'DSA',
    prerequisites: ['trees', 'stacks', 'queues'],
    related: ['computer_networks', 'graph_traversal', 'shortest_paths'],
    description: 'Adjacency list/matrix, cycle detection, degree',
  },
  {
    id: 'disjoint_set',
    label: 'Disjoint Set (Union-Find)',
    subject: 'DSA',
    prerequisites: ['trees', 'arrays_strings'],
    related: ['mst', 'graphs'],
    description: 'Path compression, union by rank/size',
  },
  {
    id: 'segment_trees',
    label: 'Segment Trees & BIT',
    subject: 'DSA',
    prerequisites: ['trees', 'binary_search', 'divide_and_conquer'],
    related: ['arrays_strings'],
    description: 'Range queries, lazy propagation, point updates',
  },

  // Algorithms
  {
    id: 'sorting',
    label: 'Sorting Algorithms',
    subject: 'DSA',
    prerequisites: ['arrays_strings'],
    related: ['greedy', 'binary_search', 'divide_and_conquer'],
    description: 'QuickSort, MergeSort, HeapSort, CountSort',
  },
  {
    id: 'binary_search',
    label: 'Binary Search',
    subject: 'DSA',
    prerequisites: ['arrays_strings', 'sorting'],
    related: ['two_pointers', 'trees'],
    description: 'Search on answer, rotated arrays, lower/upper bounds',
  },
  {
    id: 'two_pointers',
    label: 'Two Pointers',
    subject: 'DSA',
    prerequisites: ['arrays_strings'],
    related: ['sliding_window', 'binary_search', 'sorting'],
    description: 'Opposite ends, fast & slow pointers, meeting points',
  },
  {
    id: 'sliding_window',
    label: 'Sliding Window',
    subject: 'DSA',
    prerequisites: ['arrays_strings', 'two_pointers'],
    related: ['hash_tables', 'queues'],
    description: 'Fixed size, dynamic size, state tracking',
  },
  {
    id: 'recursion_backtracking',
    label: 'Recursion & Backtracking',
    subject: 'DSA',
    prerequisites: [],
    related: ['dynamic_programming', 'trees', 'divide_and_conquer'],
    description: 'N-Queens, subsets, permutations, pruning',
  },
  {
    id: 'divide_and_conquer',
    label: 'Divide & Conquer',
    subject: 'DSA',
    prerequisites: ['recursion_backtracking', 'sorting'],
    related: ['trees', 'binary_search'],
    description: 'Master theorem, inversion count, matrix multiplication',
  },
  {
    id: 'greedy',
    label: 'Greedy Algorithms',
    subject: 'DSA',
    prerequisites: ['sorting'],
    related: ['dynamic_programming', 'heaps', 'mst'],
    description: 'Interval scheduling, fractional knapsack, Huffman',
  },
  {
    id: 'dynamic_programming',
    label: 'Dynamic Programming',
    subject: 'DSA',
    prerequisites: ['recursion_backtracking', 'arrays_strings'],
    related: ['greedy', 'topological_sort'],
    description: '1D/2D DP, knapsack, LCS, digit DP, bitmask DP',
  },
  {
    id: 'graph_traversal',
    label: 'Graph Traversal (BFS/DFS)',
    subject: 'DSA',
    prerequisites: ['graphs', 'recursion_backtracking', 'queues'],
    related: ['topological_sort', 'shortest_paths'],
    description: 'Connected components, bipartite graph, flood fill',
  },
  {
    id: 'shortest_paths',
    label: 'Shortest Path Algorithms',
    subject: 'DSA',
    prerequisites: ['graph_traversal', 'heaps'],
    related: ['mst', 'dynamic_programming', 'computer_networks'],
    description: 'Dijkstra, Bellman-Ford, Floyd-Warshall',
  },
  {
    id: 'mst',
    label: 'Minimum Spanning Tree',
    subject: 'DSA',
    prerequisites: ['graphs', 'greedy', 'disjoint_set'],
    related: ['shortest_paths'],
    description: "Prim's, Kruskal's algorithms & cut property",
  },
  {
    id: 'topological_sort',
    label: 'Topological Sort',
    subject: 'DSA',
    prerequisites: ['graph_traversal'],
    related: ['dynamic_programming'],
    description: "Kahn's algorithm, DFS with post-order, DAGs",
  },
  {
    id: 'bit_manipulation',
    label: 'Bit Manipulation',
    subject: 'DSA',
    prerequisites: [],
    related: ['dynamic_programming', 'math_number_theory'],
    description: 'Bitmasking, single number, subsets via bits',
  },
  {
    id: 'math_number_theory',
    label: 'Math & Number Theory',
    subject: 'DSA',
    prerequisites: [],
    related: ['bit_manipulation', 'arrays_strings'],
    description: 'Sieve of Eratosthenes, GCD/Euclid, modular arithmetic',
  },

  // SQL & DBMS
  {
    id: 'sql_queries',
    label: 'SQL Queries & Joins',
    subject: 'SQL',
    prerequisites: [],
    related: ['dbms_fundamentals', 'hash_tables'],
    description: 'Window functions, CTEs, GROUP BY, self joins',
  },
  {
    id: 'dbms_fundamentals',
    label: 'DBMS & Indexing',
    subject: 'DBMS',
    prerequisites: ['sql_queries'],
    related: ['operating_systems', 'hash_tables', 'trees'],
    description: 'B-Trees, WAL, isolation levels, concurrency control',
  },

  // Core CS
  {
    id: 'operating_systems',
    label: 'Operating Systems',
    subject: 'OS',
    prerequisites: [],
    related: ['dbms_fundamentals', 'heaps', 'computer_networks'],
    description: 'Deadlocks, virtual memory, paging, threads vs processes',
  },
  {
    id: 'computer_networks',
    label: 'Computer Networks',
    subject: 'CN',
    prerequisites: [],
    related: ['graphs', 'operating_systems', 'shortest_paths'],
    description: 'TCP handshakes, DNS, HTTP/HTTPS, congestion control',
  },

  // OOP
  {
    id: 'oop_principles',
    label: 'OOP & SOLID Principles',
    subject: 'OOP',
    prerequisites: [],
    related: ['design_patterns'],
    description: 'Encapsulation, inheritance, polymorphism, abstraction, SOLID',
  },
  {
    id: 'design_patterns',
    label: 'Design Patterns',
    subject: 'OOP',
    prerequisites: ['oop_principles'],
    related: ['trees', 'graphs'],
    description: 'Singleton, Factory, Observer, Strategy, Decorator patterns',
  },
];

/**
 * Returns the active topic catalog.
 * Defaults to Onboarding Step 2 topics as single source of truth,
 * with seed catalog available as fallback.
 */
export function getTopicCatalog(source: 'onboarding' | 'seed' = 'onboarding'): Topic[] {
  return source === 'seed' ? SEED_CATALOG : ONBOARDING_TOPIC_CATALOG;
}
