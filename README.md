# Chemical Structure Art
Generates SVG structural formula(using https://github.com/SilentSpringInstitute/sdftosvg) for chemicals pulled from https://pubchem.ncbi.nlm.nih.gov/.

<p style="text-align:center">
  <img src="https://raw.githubusercontent.com/davidhampgonsalves/chemical-structures/master/sample-01.jpg" width="100%">
  <img src="https://raw.githubusercontent.com/davidhampgonsalves/chemical-structures/master/sample-02.jpg" width="100%">
</p>

## Setup
```
yarn install
```

## Workflow
- Generate some random chemical structures.
  - `node index.js generate-rand 10`
  - `node index.js generate 222656 62344`
- Use inkscape to merge all svg's from `/out` making sure they don't overlap(using align).
- Run that svg through https://deepnest.io/ to create an interesting and semi-optimally packed presentation.
- Remove concave hulls (which were required to have deepnest work) - `node index.js clean nested.svg`.
- Plot!
