# Cosine similarity

Cosine similarity compares the direction of two vectors rather than simply comparing their absolute magnitude.

Mathematically:

$$ \text{cosineSimilarity}(A,B) = \frac{A \cdot B} {\|A\|\|B\|} $$

There are three pieces.

First, the dot product:

A = [a1, a2, a3]
B = [b1, b2, b3]

A · B =
a1*b1 + a2*b2 + a3\*b3

Second, the magnitude of each vector:

$$ \|A\| = \sqrt{a_1^2+a_2^2+a_3^2} $$

Finally:

dot product
────────────────────────
magnitude(A) \* magnitude(B)

Geometrically, this corresponds to the cosine of the angle between the vectors.

Similar meaning

        A
       ↗
      ↗ B

small angle
→ high cosine similarity

Different meaning

       A ↑
         |
         |

─────────→ B

large angle
→ lower similarity

For many embeddings, the closer the directions, the more semantically related the texts tend to be.

3. Small calculation

Let's simplify even further:

query = [1, 1]
refund = [2, 2]

Dot product:

(1 × 2) + (1 × 2)
= 4

Magnitudes:

|query| = √(1² + 1²)
= √2

|refund| = √(2² + 2²)
= √8

Therefore:

$$ similarity = \frac{4}{\sqrt{2}\sqrt{8}} =1 $$

They're pointing in exactly the same direction.

Now compare:

query = [1, 1]
unrelated = [1, -1]

Dot product:

1×1 + 1×(-1)
= 0

so cosine similarity is 0.

Conceptually:

refund → 1.00
shipping → maybe 0.63
password → maybe 0.12

Then we rank descending and take top-K.

# RAG architecture

```shell
Chunking
→ text → smaller pieces of text

Embedding
→ text → numerical vector

Vector indexing
→ organize vectors for efficient search

Retrieval
→ query vector → find relevant stored vectors

Generation
→ retrieved text + question → LLM answer

```

# Setup

1. Run chunk script as mentioned below

```shell
uv run python -m rag.chunk
```

use this because `uv run python rag/chunk.py`gives error since config module is outside the context to get the openai api key
