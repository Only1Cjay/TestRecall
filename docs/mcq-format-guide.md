# MCQ Format Guide

The exact format TestRecall can read. Give this file to any bot or AI that
makes MCQ PDFs for you, and tell it: follow this structure exactly.

## The rules

- **Text-based PDF only.** The PDF must contain real typed text, not a photo
  or scan of a page. The app reads text; it cannot read pictures of text.
- **One question per number.** Each question starts a new line with its
  number, a full stop and a space: `1. Question text?` Then `2.`, `3.`,
  `4.` and so on, in order, with no gaps.
- **Four options per question.** Labelled `A.` `B.` `C.` `D.` Each option
  starts with its letter, a full stop and a space. Put one option on each
  line, or two on a line (A and B on one line, C and D on the next) — both
  work.
- **Exactly one correct answer** per question.
- **Put the key at the very end**, under its own heading. Write it in rows
  of 10: first a line with the question numbers, then a line with the
  correct letters underneath. Example: `1 2 3 4 5 6 7 8 9 10` on one line,
  then `B A D C B A D C B A` on the next line. For a longer set, keep adding
  rows of 10 the same way (11 12 13 ... 20, then the letters, and so on).
- **Keep everything in one file:** questions first, then the key. Nothing
  else after the key.
- **Do not write `A.` / `B.` / `C.` / `D.` inside question or option text**
  (for example, do not write "vitamin B. complex" in an option). The app
  finds options by looking for those letters, so stray ones confuse it.

## Worked example — 10 questions in the exact format

```
1. Which organelle is known as the powerhouse of the cell?
A. Ribosome   B. Mitochondrion
C. Nucleus   D. Golgi body

2. In binomial nomenclature, the first word of a bacterial name is the:
A. Species   B. Genus
C. Family   D. Strain

3. Which of these bacteria is comma-shaped?
A. Staphylococcus aureus   B. Escherichia coli
C. Vibrio cholerae   D. Bacillus subtilis

4. A bacterium that grows only in the presence of oxygen is called a:
A. Facultative anaerobe   B. Obligate anaerobe
C. Obligate aerobe   D. Microaerophile

5. Which structure allows a bacterium to survive harsh conditions?
A. Capsule   B. Endospore
C. Pilus   D. Flagellum

6. The Gram stain separates bacteria mainly by differences in their:
A. Nucleus   B. Cell wall
C. Ribosome   D. Plasmid

7. Which of these is a coccus arranged in clusters?
A. Streptococcus   B. Staphylococcus
C. Diplococcus   D. Tetrad

8. A mesophile grows best at about:
A. 4°C   B. 20°C
C. 37°C   D. 60°C

9. Which organism causes cholera?
A. Salmonella typhi   B. Vibrio cholerae
C. Mycobacterium tuberculosis   D. Neisseria gonorrhoeae

10. Penicillin fails against Mycoplasma because Mycoplasma has no:
A. Ribosome   B. Cell membrane
C. Cell wall   D. DNA

Answer Key
1 2 3 4 5 6 7 8 9 10
B B C C B B B C B C
```
