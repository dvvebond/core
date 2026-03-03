# Benchmark Report

> Generated on 2026-03-03 at 22:18:40 UTC
>
> System: linux | AMD EPYC 7763 64-Core Processor (4 cores) | 16GB RAM | Bun 1.3.10

---

## Contents

- [Comparison](#comparison)
- [Copying](#copying)
- [Drawing](#drawing)
- [Forms](#forms)
- [Loading](#loading)
- [Saving](#saving)
- [Splitting](#splitting)

## Comparison

### Load PDF

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |   407.0 |  2.46ms |  3.92ms | ±1.68% |     204 |
| pdf-lib   |    24.8 | 40.37ms | 46.62ms | ±3.98% |      13 |

- **libpdf** is 16.43x faster than pdf-lib

### Create blank PDF

| Benchmark | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------- | ------: | ----: | -----: | -----: | ------: |
| libpdf    |   17.6K |  57us |  117us | ±1.78% |   8,788 |
| pdf-lib   |    2.4K | 424us | 1.55ms | ±2.58% |   1,181 |

- **libpdf** is 7.44x faster than pdf-lib

### Add 10 pages

| Benchmark | ops/sec |  Mean |    p99 |    RME | Samples |
| :-------- | ------: | ----: | -----: | -----: | ------: |
| libpdf    |   10.0K | 100us |  165us | ±1.42% |   4,998 |
| pdf-lib   |    1.9K | 523us | 2.04ms | ±2.90% |     956 |

- **libpdf** is 5.23x faster than pdf-lib

### Draw 50 rectangles

| Benchmark | ops/sec |   Mean |    p99 |    RME | Samples |
| :-------- | ------: | -----: | -----: | -----: | ------: |
| libpdf    |    3.1K |  327us |  933us | ±1.69% |   1,530 |
| pdf-lib   |   593.2 | 1.69ms | 6.28ms | ±6.49% |     297 |

- **libpdf** is 5.16x faster than pdf-lib

### Load and save PDF

| Benchmark | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------- | ------: | ------: | -------: | -----: | ------: |
| libpdf    |   401.1 |  2.49ms |   3.72ms | ±1.85% |     201 |
| pdf-lib   |    11.0 | 90.64ms | 117.82ms | ±8.14% |      10 |

- **libpdf** is 36.36x faster than pdf-lib

### Load, modify, and save PDF

| Benchmark | ops/sec |    Mean |      p99 |    RME | Samples |
| :-------- | ------: | ------: | -------: | -----: | ------: |
| libpdf    |    21.5 | 46.53ms |  53.62ms | ±4.46% |      11 |
| pdf-lib   |    10.9 | 91.81ms | 101.83ms | ±4.01% |      10 |

- **libpdf** is 1.97x faster than pdf-lib

### Extract single page from 100-page PDF

| Benchmark | ops/sec |   Mean |     p99 |    RME | Samples |
| :-------- | ------: | -----: | ------: | -----: | ------: |
| libpdf    |   264.7 | 3.78ms |  4.54ms | ±1.13% |     133 |
| pdf-lib   |   102.7 | 9.74ms | 13.08ms | ±3.06% |      52 |

- **libpdf** is 2.58x faster than pdf-lib

### Split 100-page PDF into single-page PDFs

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |    29.4 | 34.06ms | 37.93ms | ±2.09% |      15 |
| pdf-lib   |    11.3 | 88.17ms | 90.60ms | ±2.36% |       6 |

- **libpdf** is 2.59x faster than pdf-lib

### Split 2000-page PDF into single-page PDFs (0.9MB)

| Benchmark | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------- | ------: | -------: | -------: | -----: | ------: |
| libpdf    |     1.6 | 640.29ms | 640.29ms | ±0.00% |       1 |
| pdf-lib   |   0.603 |    1.66s |    1.66s | ±0.00% |       1 |

- **libpdf** is 2.59x faster than pdf-lib

### Copy 10 pages between documents

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |   215.2 |  4.65ms |  5.46ms | ±1.12% |     108 |
| pdf-lib   |    80.8 | 12.38ms | 14.37ms | ±1.84% |      41 |

- **libpdf** is 2.66x faster than pdf-lib

### Merge 2 x 100-page PDFs

| Benchmark | ops/sec |    Mean |     p99 |    RME | Samples |
| :-------- | ------: | ------: | ------: | -----: | ------: |
| libpdf    |    66.5 | 15.05ms | 19.12ms | ±1.94% |      34 |
| pdf-lib   |    18.3 | 54.77ms | 56.70ms | ±1.12% |      10 |

- **libpdf** is 3.64x faster than pdf-lib

## Copying

### Copy pages between documents

| Benchmark                       | ops/sec |   Mean |    p99 |    RME | Samples |
| :------------------------------ | ------: | -----: | -----: | -----: | ------: |
| copy 1 page                     |   965.5 | 1.04ms | 2.11ms | ±2.48% |     483 |
| copy 10 pages from 100-page PDF |   211.7 | 4.72ms | 6.81ms | ±1.99% |     106 |
| copy all 100 pages              |   129.9 | 7.70ms | 8.68ms | ±1.03% |      65 |

- **copy 1 page** is 4.56x faster than copy 10 pages from 100-page PDF
- **copy 1 page** is 7.43x faster than copy all 100 pages

### Duplicate pages within same document

| Benchmark                                 | ops/sec |  Mean |    p99 |    RME | Samples |
| :---------------------------------------- | ------: | ----: | -----: | -----: | ------: |
| duplicate all pages (double the document) |    1.1K | 893us | 1.44ms | ±0.97% |     561 |
| duplicate page 0                          |    1.1K | 901us | 1.60ms | ±1.11% |     555 |

- **duplicate all pages (double the document)** is 1.01x faster than duplicate page 0

### Merge PDFs

| Benchmark               | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------------- | ------: | ------: | ------: | -----: | ------: |
| merge 2 small PDFs      |   682.5 |  1.47ms |  2.01ms | ±0.97% |     342 |
| merge 10 small PDFs     |   129.1 |  7.74ms | 10.06ms | ±1.28% |      65 |
| merge 2 x 100-page PDFs |    71.8 | 13.93ms | 16.20ms | ±1.18% |      36 |

- **merge 2 small PDFs** is 5.29x faster than merge 10 small PDFs
- **merge 2 small PDFs** is 9.51x faster than merge 2 x 100-page PDFs

## Drawing

| Benchmark                           | ops/sec |   Mean |    p99 |    RME | Samples |
| :---------------------------------- | ------: | -----: | -----: | -----: | ------: |
| draw 100 lines                      |    2.0K |  509us | 1.23ms | ±1.71% |     984 |
| draw 100 rectangles                 |    1.8K |  569us | 1.45ms | ±2.09% |     881 |
| draw 100 circles                    |   751.9 | 1.33ms | 3.20ms | ±3.29% |     376 |
| create 10 pages with mixed content  |   737.6 | 1.36ms | 2.51ms | ±2.26% |     369 |
| draw 100 text lines (standard font) |   632.5 | 1.58ms | 2.58ms | ±1.68% |     317 |

- **draw 100 lines** is 1.12x faster than draw 100 rectangles
- **draw 100 lines** is 2.62x faster than draw 100 circles
- **draw 100 lines** is 2.67x faster than create 10 pages with mixed content
- **draw 100 lines** is 3.11x faster than draw 100 text lines (standard font)

## Forms

| Benchmark         | ops/sec |    Mean |     p99 |    RME | Samples |
| :---------------- | ------: | ------: | ------: | -----: | ------: |
| read field values |   339.1 |  2.95ms |  3.93ms | ±1.36% |     170 |
| get form fields   |   301.3 |  3.32ms |  6.15ms | ±3.26% |     151 |
| flatten form      |   116.6 |  8.58ms | 13.62ms | ±3.10% |      59 |
| fill text fields  |    86.4 | 11.58ms | 20.03ms | ±4.96% |      44 |

- **read field values** is 1.13x faster than get form fields
- **read field values** is 2.91x faster than flatten form
- **read field values** is 3.93x faster than fill text fields

## Loading

| Benchmark              | ops/sec |   Mean |    p99 |    RME | Samples |
| :--------------------- | ------: | -----: | -----: | -----: | ------: |
| load small PDF (888B)  |   16.2K |   62us |  149us | ±0.87% |   8,110 |
| load medium PDF (19KB) |   10.7K |   94us |  137us | ±0.65% |   5,340 |
| load form PDF (116KB)  |   685.4 | 1.46ms | 2.71ms | ±1.85% |     343 |
| load heavy PDF (9.9MB) |   424.6 | 2.36ms | 2.84ms | ±0.70% |     213 |

- **load small PDF (888B)** is 1.52x faster than load medium PDF (19KB)
- **load small PDF (888B)** is 23.66x faster than load form PDF (116KB)
- **load small PDF (888B)** is 38.20x faster than load heavy PDF (9.9MB)

## Saving

| Benchmark                          | ops/sec |   Mean |     p99 |    RME | Samples |
| :--------------------------------- | ------: | -----: | ------: | -----: | ------: |
| save unmodified (19KB)             |    7.8K |  128us |   318us | ±3.25% |   3,893 |
| incremental save (19KB)            |    5.2K |  193us |   388us | ±2.76% |   2,587 |
| save with modifications (19KB)     |    1.2K |  828us |  2.40ms | ±4.37% |     604 |
| save heavy PDF (9.9MB)             |   398.4 | 2.51ms |  4.05ms | ±2.10% |     200 |
| incremental save heavy PDF (9.9MB) |   111.9 | 8.93ms | 10.41ms | ±3.01% |      56 |

- **save unmodified (19KB)** is 1.50x faster than incremental save (19KB)
- **save unmodified (19KB)** is 6.45x faster than save with modifications (19KB)
- **save unmodified (19KB)** is 19.54x faster than save heavy PDF (9.9MB)
- **save unmodified (19KB)** is 69.57x faster than incremental save heavy PDF (9.9MB)

## Splitting

### Extract single page

| Benchmark                                | ops/sec |    Mean |     p99 |    RME | Samples |
| :--------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extractPages (1 page from small PDF)     |   992.5 |  1.01ms |  2.05ms | ±2.60% |     497 |
| extractPages (1 page from 100-page PDF)  |   262.3 |  3.81ms |  7.46ms | ±3.75% |     132 |
| extractPages (1 page from 2000-page PDF) |    16.3 | 61.30ms | 69.78ms | ±4.07% |      10 |

- **extractPages (1 page from small PDF)** is 3.78x faster than extractPages (1 page from 100-page PDF)
- **extractPages (1 page from small PDF)** is 60.84x faster than extractPages (1 page from 2000-page PDF)

### Split into single-page PDFs

| Benchmark                   | ops/sec |     Mean |      p99 |    RME | Samples |
| :-------------------------- | ------: | -------: | -------: | -----: | ------: |
| split 100-page PDF (0.1MB)  |    29.3 |  34.14ms |  38.68ms | ±3.60% |      15 |
| split 2000-page PDF (0.9MB) |     1.6 | 623.93ms | 623.93ms | ±0.00% |       1 |

- **split 100-page PDF (0.1MB)** is 18.27x faster than split 2000-page PDF (0.9MB)

### Batch page extraction

| Benchmark                                              | ops/sec |    Mean |     p99 |    RME | Samples |
| :----------------------------------------------------- | ------: | ------: | ------: | -----: | ------: |
| extract first 10 pages from 2000-page PDF              |    16.7 | 59.97ms | 61.44ms | ±0.86% |       9 |
| extract first 100 pages from 2000-page PDF             |    15.7 | 63.80ms | 65.51ms | ±1.82% |       8 |
| extract every 10th page from 2000-page PDF (200 pages) |    14.6 | 68.53ms | 70.07ms | ±1.09% |       8 |

- **extract first 10 pages from 2000-page PDF** is 1.06x faster than extract first 100 pages from 2000-page PDF
- **extract first 10 pages from 2000-page PDF** is 1.14x faster than extract every 10th page from 2000-page PDF (200 pages)

---

_Results are machine-dependent. Use for relative comparison only._
