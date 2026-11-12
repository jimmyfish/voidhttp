# AGENTS.md

## Project knowledge: read the graphify graph first

This repo has a graphify knowledge graph in `graphify-out/`. Read it before you explore the code.

1. At the start of every task, read `graphify-out/GRAPH_REPORT.md`. It lists the communities, the most connected nodes ("god nodes"), the links between modules, and the group relationships.
2. To answer a question about structure, ownership, call flow or data flow, query the graph before you grep or open files:
   - `graphify query "<question>"`: broad context (BFS)
   - `graphify query "<question>" --dfs`: follow one specific path
   - `graphify path "A" "B"`: shortest path between two nodes
   - `graphify explain "X"`: a node and its neighbors
3. Use the graph to find the right files, then read those files to confirm. Edges marked INFERRED or AMBIGUOUS are guesses that need checking. Treat only EXTRACTED edges as facts.
4. After you change code, run `graphify update .` to refresh `graphify-out/graph.json`. If you change README.md or other docs, run `/graphify . --update`.
5. If `graphify-out/graph.json` is missing, run `/graphify .` to build it before relying on the graph.
