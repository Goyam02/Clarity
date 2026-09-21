import { TopicCategory } from '../types';

export const SKILL_CATEGORIES: TopicCategory[] = [
  {
    id: 'data-structures',
    name: 'Data Structures',
    shortName: 'Data Structures',
    description: 'Core linear and non-linear data arrangements and indexed lookup structures',
    topics: [
      { id: 'arrays_strings', name: 'Arrays & Strings', description: 'Prefix sums, sliding buffers, 2D matrices' },
      { id: 'linked_lists', name: 'Linked Lists (Singly & Doubly)', description: 'Pointers, cycles, reversal, reordering' },
      { id: 'stacks', name: 'Stacks', description: 'Monotonic stack, expression parsing, parentheses' },
      { id: 'queues', name: 'Queues (incl. Deque & Circular Queue)', description: 'Sliding window maximum, BFS queueing' },
      { id: 'hash_tables', name: 'Hash Tables / Hash Maps', description: 'Collision handling, frequency counters, custom hash' },
      { id: 'trees', name: 'Trees (Binary Trees & BSTs)', description: 'LCA, diameter, AVL/balanced trees, traversals' },
      { id: 'heaps', name: 'Heaps / Priority Queues', description: 'Min/max heaps, top-K elements, median tracking' },
      { id: 'tries', name: 'Tries (Prefix Trees)', description: 'Prefix searches, auto-complete, XOR maximum' },
      { id: 'graphs', name: 'Graphs (Representation & Basics)', description: 'Adjacency list/matrix, cycle detection, degree' },
      { id: 'disjoint_set', name: 'Disjoint Set / Union-Find', description: 'Path compression, union by rank/size' },
      { id: 'segment_trees', name: 'Segment Trees / Fenwick Trees (BIT)', description: 'Range queries, lazy propagation, point updates' },
    ],
  },
  {
    id: 'algorithms',
    name: 'Algorithms & Techniques',
    shortName: 'Algorithms',
    description: 'Algorithmic paradigms, search & traversal patterns, and analytical paradigms',
    topics: [
      { id: 'sorting', name: 'Sorting Algorithms', description: 'QuickSort, MergeSort, HeapSort, CountSort' },
      { id: 'binary_search', name: 'Binary Search', description: 'Search on answer, rotated arrays, lower/upper bounds' },
      { id: 'two_pointers', name: 'Two Pointers', description: 'Opposite ends, fast & slow pointers, meeting points' },
      { id: 'sliding_window', name: 'Sliding Window', description: 'Fixed size, dynamic size, state tracking' },
      { id: 'recursion_backtracking', name: 'Recursion & Backtracking', description: 'N-Queens, subsets, permutations, pruning' },
      { id: 'divide_and_conquer', name: 'Divide and Conquer', description: 'Master theorem, inversion count, matrix multiplication' },
      { id: 'greedy', name: 'Greedy Algorithms', description: 'Interval scheduling, fractional knapsack, Huffman' },
      { id: 'dynamic_programming', name: 'Dynamic Programming', description: '1D/2D DP, knapsack, LCS, digit DP, bitmask DP' },
      { id: 'graph_traversal', name: 'Graph Traversal (BFS / DFS)', description: 'Connected components, bipartite graph, flood fill' },
      { id: 'shortest_paths', name: 'Shortest Path Algorithms', description: 'Dijkstra, Bellman-Ford, Floyd-Warshall' },
      { id: 'mst', name: 'Minimum Spanning Tree', description: "Prim's, Kruskal's algorithms & cut property" },
      { id: 'topological_sort', name: 'Topological Sort', description: "Kahn's algorithm, DFS with post-order, DAGs" },
      { id: 'bit_manipulation', name: 'Bit Manipulation', description: 'Bitmasking, single number, subsets via bits' },
      { id: 'math_number_theory', name: 'Math & Number Theory', description: 'Sieve of Eratosthenes, GCD/Euclid, modular arithmetic' },
    ],
  },
  {
    id: 'sql-dbms',
    name: 'SQL & DBMS',
    shortName: 'SQL & DBMS',
    description: 'Relational data querying, storage engines, transactional integrity, and schema architecture',
    topics: [
      { id: 'sql_queries', name: 'SQL (Queries, Joins, Aggregations, Subqueries)', description: 'Window functions, CTEs, GROUP BY, self joins' },
      { id: 'dbms_fundamentals', name: 'DBMS Fundamentals (Normalization, ACID, Indexing, Keys)', description: 'B-Trees, WAL, isolation levels, concurrency control' },
    ],
  },
  {
    id: 'core-cs',
    name: 'Core CS Fundamentals',
    shortName: 'Core CS',
    description: 'System-level architecture, runtime processes, hardware abstraction, and networking',
    topics: [
      { id: 'operating_systems', name: 'Operating Systems (Processes, Scheduling, Memory, Concurrency)', description: 'Deadlocks, virtual memory, paging, threads vs processes' },
      { id: 'computer_networks', name: 'Computer Networks (OSI/TCP-IP, Protocols, Routing)', description: 'TCP handshakes, DNS, HTTP/HTTPS, congestion control' },
    ],
  },
  {
    id: 'oop-design',
    name: 'Object-Oriented Programming',
    shortName: 'OOP & Design',
    description: 'Software design principles, object models, and recurring architectural patterns',
    topics: [
      { id: 'oop_principles', name: 'OOP Fundamentals & SOLID Principles', description: 'Encapsulation, inheritance, polymorphism, abstraction, SRP, DIP' },
      { id: 'design_patterns', name: 'Design Patterns & System Modeling', description: 'Singleton, Factory, Observer, Strategy, Decorator patterns' },
    ],
  },
];

export const RATING_LEVELS = [
  { value: 1, label: 'Novice', shortLabel: 'Novice', description: 'Just starting / Theoretical understanding' },
  { value: 2, label: 'Familiar', shortLabel: 'Familiar', description: 'Can solve easy questions with guidance' },
  { value: 3, label: 'Comfortable', shortLabel: 'Comfortable', description: 'Can independently solve LeetCode mediums' },
  { value: 4, label: 'Strong', shortLabel: 'Strong', description: 'Interview-ready, fast time & space trade-offs' },
  { value: 5, label: 'Expert', shortLabel: 'Expert', description: 'Mastered, can teach nuances & edge cases' },
];

export const DEFAULT_RATING = 3;

export const getDefaultSkillRatings = (): Record<string, number> => {
  const ratings: Record<string, number> = {};
  for (const category of SKILL_CATEGORIES) {
    for (const topic of category.topics) {
      ratings[topic.id] = DEFAULT_RATING;
    }
  }
  return ratings;
};
