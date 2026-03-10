# CJK Test Fixtures

This directory contains test fixtures for CJK (Chinese, Japanese, Korean) character mapping support.

## CMap Data Files

- `test-cmap.txt` - A sample CMap file for testing CMap parsing
- `chinese-cmap.txt` - Simplified Chinese character mappings
- `japanese-cmap.txt` - Japanese character mappings (Hiragana, Katakana, Kanji)
- `korean-cmap.txt` - Korean Hangul character mappings

## Usage

These files are used by the CMap tests to verify:

1. CMap parsing functionality
2. Character code to Unicode mapping
3. CID mapping for composite fonts
4. Multi-byte character handling

## Format

CMap files follow the Adobe CMap format with:

- `begincodespacerange` / `endcodespacerange` - Valid code ranges
- `beginbfchar` / `endbfchar` - Individual character mappings
- `beginbfrange` / `endbfrange` - Range mappings
- `begincidchar` / `endcidchar` - CID character mappings
- `begincidrange` / `endcidrange` - CID range mappings
