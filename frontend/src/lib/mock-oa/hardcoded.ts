import { MockOAPayload } from './types';

/**
 * Hardcoded Google Mock Online Assessment data payload.
 * When the backend service is implemented, only lib/mock-oa/api.ts
 * will be swapped to fetch dynamic payloads.
 */
export const HARDCODED_GOOGLE_MOCK_OA: MockOAPayload = {
  id: 'google-oa-2026',
  company: 'Google',
  year: 2026,
  durationMinutes: 70,
  problems: [
    {
      id: 'p1',
      title: 'Balanced Shipments',
      difficulty: 'Medium',
      topicIds: ['binary-search', 'arrays'],
      statement: `You are overseeing automated logistics at a global distribution center. A conveyor line delivers a sequence of $n$ packages whose weights are strictly preserved in incoming order: $w_1, w_2, \\dots, w_n$.

You must partition all $n$ packages into at most $D$ consecutive shipping days such that every package is dispatched. Due to crane structural safety limits, every shipping day has an identical maximum weight capacity $C$.

Determine the **minimum possible capacity $C$** that allows all packages to be shipped in order within $D$ days without dividing or reordering any individual package.`,
      inputFormat: `The first line contains two space-separated integers, $n$ and $D$, representing the number of packages and the maximum days.
The second line contains $n$ space-separated integers $w_1, w_2, \\dots, w_n$, representing the package weights in delivery order.`,
      outputFormat: `Print a single integer: the minimum capacity $C$ required to ship all packages in at most $D$ contiguous days.`,
      constraints: [
        '1 \\le D \\le n \\le 200000',
        '1 \\le w_i \\le 10^9$ (use 64-bit integer types to avoid overflow)',
      ],
      examples: [
        {
          input: `6 3\n7 2 5 10 8 1`,
          output: `14`,
          explanation: `With capacity 14, the packages can be partitioned into 3 consecutive days:\n- Day 1: [7, 2, 5] (total weight = 14)\n- Day 2: [10] (total weight = 10)\n- Day 3: [8, 1] (total weight = 9)\nNo smaller capacity can satisfy the D = 3 deadline.`,
        },
        {
          input: `5 2\n1 2 3 4 5`,
          output: `9`,
          explanation: `With capacity 9, shipments are divided into:\n- Day 1: [1, 2, 3] (total weight = 6)\n- Day 2: [4, 5] (total weight = 9)`,
        },
        {
          input: `4 4\n10 20 30 40`,
          output: `40`,
          explanation: `Since D = n, every package can travel on an independent day. The minimum required capacity is max(w_i) = 40.`,
        },
      ],
      sampleStdin: `6 3\n7 2 5 10 8 1\n`,
      starter: {
        python: `import sys

def solve():
    raw = sys.stdin.read().split()
    if not raw:
        return
    n = int(raw[0])
    d = int(raw[1])
    weights = [int(x) for x in raw[2:2 + n]]

    # TODO: Implement binary search on the minimum daily capacity
    low = max(weights)
    high = sum(weights)
    ans = high

    while low <= high:
        mid = (low + high) // 2
        days = 1
        curr = 0
        for w in weights:
            if curr + w > mid:
                days += 1
                curr = w
            else:
                curr += w
        if days <= d:
            ans = mid
            high = mid - 1
        else:
            low = mid + 1

    print(ans)

if __name__ == '__main__':
    solve()
`,
        java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextInt()) return;

        int n = sc.nextInt();
        int d = sc.nextInt();
        long[] weights = new long[n];
        long maxW = 0;
        long sumW = 0;

        for (int i = 0; i < n; i++) {
            weights[i] = sc.nextLong();
            if (weights[i] > maxW) maxW = weights[i];
            sumW += weights[i];
        }

        long low = maxW;
        long high = sumW;
        long ans = sumW;

        while (low <= high) {
            long mid = low + (high - low) / 2;
            int days = 1;
            long curr = 0;
            for (long w : weights) {
                if (curr + w > mid) {
                    days++;
                    curr = w;
                } else {
                    curr += w;
                }
            }
            if (days <= d) {
                ans = mid;
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }

        System.out.println(ans);
    }
}
`,
        cpp: `#include <iostream>
#include <vector>
#include <numeric>
#include <algorithm>

using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    int n, d;
    if (!(cin >> n >> d)) return 0;

    vector<long long> weights(n);
    long long maxW = 0;
    long long sumW = 0;

    for (int i = 0; i < n; i++) {
        cin >> weights[i];
        if (weights[i] > maxW) maxW = weights[i];
        sumW += weights[i];
    }

    long long low = maxW;
    long long high = sumW;
    long long ans = sumW;

    while (low <= high) {
        long long mid = low + (high - low) / 2;
        int days = 1;
        long long curr = 0;
        for (long long w : weights) {
            if (curr + w > mid) {
                days++;
                curr = w;
            } else {
                curr += w;
            }
        }
        if (days <= d) {
            ans = mid;
            high = mid - 1;
        } else {
            low = mid + 1;
        }
    }

    cout << ans << "\\n";
    return 0;
}
`,
      },
    },
    {
      id: 'p2',
      title: 'Prefix Autocomplete',
      difficulty: 'Hard',
      topicIds: ['tries', 'strings', 'sorting'],
      statement: `Modern search input components require low-latency prefix suggestions. You are building a real-time autocomplete engine backed by a dictionary of $n$ indexed terms, each associated with an integer popularity score.

Given $q$ subsequent search prefix queries, your system must return **up to 3 distinct words** matching the queried prefix, ordered by:
1. **Popularity score descending** (higher score appears first).
2. **Lexicographical order ascending** for words with identical scores.

If fewer than 3 terms match the prefix, return all matching terms in specified order. If no dictionary words start with the prefix, print \`-\`.`,
      inputFormat: `The first line contains integer $n$, the total number of dictionary words.
The subsequent $n$ lines each contain a string $word$ and integer $score$, separated by a space.
The next line contains integer $q$, the number of queries.
The subsequent $q$ lines each contain a prefix query string.`,
      outputFormat: `For each query, output a single line with up to 3 space-separated matching words, or \`-\` if none match.`,
      constraints: [
        '1 \\le n \\le 50000',
        '1 \\le q \\le 50000',
        'Total length of all words and queries \\le 200000',
        'All words consist solely of lowercase English characters [a-z]',
        '0 \\le score \\le 10^9',
      ],
      examples: [
        {
          input: `5\napple 50\napp 70\napply 50\napt 10\nbanana 5\n3\nap\napp\nb`,
          output: `app apple apply\napp apple apply\nbanana`,
          explanation: `For prefix "ap", candidate terms are:\n- app (score 70)\n- apple (score 50)\n- apply (score 50)\n- apt (score 10)\nTop 3 are app, apple, apply (apple ties with apply, sorted alphabetically).\nFor prefix "app", candidates are app, apple, apply.\nFor prefix "b", only banana matches.`,
        },
        {
          input: `3\ngoogle 100\ngo 100\ngolang 90\n2\ngo\nz`,
          output: `go google golang\n-`,
          explanation: `For "go", go and google tie at 100 (go < google lexicographically), followed by golang (90).\nFor "z", zero dictionary words start with "z", producing "-".`,
        },
      ],
      sampleStdin: `5\napple 50\napp 70\napply 50\napt 10\nbanana 5\n3\nap\napp\nb\n`,
      starter: {
        python: `import sys

def solve():
    lines = sys.stdin.read().split()
    if not lines:
        return
    idx = 0
    n = int(lines[idx])
    idx += 1

    words = []
    for _ in range(n):
        w = lines[idx]
        s = int(lines[idx + 1])
        idx += 2
        words.append((w, s))

    # Sort by score descending, then word ascending
    words.sort(key=lambda x: (-x[1], x[0]))

    # Build prefix lookup (Trie or dict mapping)
    prefix_map = {}
    for w, s in words:
        for i in range(1, len(w) + 1):
            pref = w[:i]
            if pref not in prefix_map:
                prefix_map[pref] = []
            if len(prefix_map[pref]) < 3:
                prefix_map[pref].append(w)

    q = int(lines[idx])
    idx += 1
    for _ in range(q):
        query = lines[idx]
        idx += 1
        res = prefix_map.get(query, [])
        if not res:
            print("-")
        else:
            print(" ".join(res))

if __name__ == '__main__':
    solve()
`,
        java: `import java.util.*;

public class Main {
    static class Item {
        String word;
        int score;
        Item(String w, int s) { this.word = w; this.score = s; }
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextInt()) return;

        int n = sc.nextInt();
        List<Item> items = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            String w = sc.next();
            int s = sc.nextInt();
            items.add(new Item(w, s));
        }

        items.sort((a, b) -> {
            if (a.score != b.score) return Integer.compare(b.score, a.score);
            return a.word.compareTo(b.word);
        });

        Map<String, List<String>> prefixMap = new HashMap<>();
        for (Item item : items) {
            for (int len = 1; len <= item.word.length(); len++) {
                String pref = item.word.substring(0, len);
                List<String> list = prefixMap.computeIfAbsent(pref, k -> new ArrayList<>());
                if (list.size() < 3) {
                    list.add(item.word);
                }
            }
        }

        int q = sc.nextInt();
        for (int i = 0; i < q; i++) {
            String query = sc.next();
            List<String> matches = prefixMap.get(query);
            if (matches == null || matches.isEmpty()) {
                System.out.println("-");
            } else {
                System.out.println(String.join(" ", matches));
            }
        }
    }
}
`,
        cpp: `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <unordered_map>

using namespace std;

struct Item {
    string word;
    int score;
};

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    int n;
    if (!(cin >> n)) return 0;

    vector<Item> items(n);
    for (int i = 0; i < n; i++) {
        cin >> items[i].word >> items[i].score;
    }

    sort(items.begin(), items.end(), [](const Item& a, const Item& b) {
        if (a.score != b.score) return a.score > b.score;
        return a.word < b.word;
    });

    unordered_map<string, vector<string>> prefixMap;
    for (const auto& item : items) {
        for (size_t len = 1; len <= item.word.size(); len++) {
            string pref = item.word.substr(0, len);
            auto& list = prefixMap[pref];
            if (list.size() < 3) {
                list.push_back(item.word);
            }
        }
    }

    int q;
    if (!(cin >> q)) return 0;

    for (int i = 0; i < q; i++) {
        string query;
        cin >> query;
        auto it = prefixMap.find(query);
        if (it == prefixMap.end() || it->second.empty()) {
            cout << "-\\n";
        } else {
            for (size_t j = 0; j < it->second.size(); j++) {
                if (j > 0) cout << " ";
                cout << it->second[j];
            }
            cout << "\\n";
        }
    }

    return 0;
}
`,
      },
    },
  ],
};
