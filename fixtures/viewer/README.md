# Viewer Test Fixtures

This directory contains test fixtures for viewer component tests.

## Structure

- `sample-text.json` - Sample extracted text data for text layer tests
- `search-corpus.json` - Multi-page text corpus for search tests
- `page-dimensions.json` - Various page dimension configurations

## Usage

Load fixtures using the `loadFixture` helper from `test-utils.ts`:

```typescript
import { loadFixture } from "../../test-utils";

const data = await loadFixture("viewer", "sample-text.json");
```
