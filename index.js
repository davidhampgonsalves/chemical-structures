const paper = require('paper-jsdom-canvas');
const request = require('request');
const renderer = require('sdftosvg');
const fs = require('fs');
const concaveman = require("concaveman");

paper.setup(new paper.Size(300, 600));

const COUNT=10;
const CIRCLE_BOUNDARY_DETAIL = 100;

function fetchAndDrawCompond(outstanding, cb, ids=null) {
  if(ids) outstanding = ids.length;
  if(outstanding === 0) return cb();

  let id;
  if(!id)
    id = Math.floor(Math.random() * 1000000);
  else
    id = ids.pop()
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${id}/SDF`;

  request(url, function (error, response, sdf) {
    if(error) {
      console.log("Error", error);
      process.exit(-1);
    }

    console.log("rendering", url);
    renderer.renderSdfToSvg(sdf, {}, function(svg) {
      outstanding -= 1;

      paper.project.clear();
      paper.project.importSVG(svg);
      const item = paper.project.getItem({ match: item => {
        const { width, height } = item.bounds;
        if(width === 500 && height === 500)
          return true;

        return false;
      }});

      if(!item.children) return fetchAndDrawCompond(outstanding + 1, cb, ids);

      // remove square rect
      item.children[0].children[0].remove();

      // ungroup everything
      paper.project.getItems({ recursive: true, class: paper.Group }).forEach(group => {
        if(!group.parent)
          return;

        paper.project.activeLayer.insertChildren(group.index, group.removeChildren());
        group.remove();
      }, null);

      // shorten any paths so they don't enter circles
      let points = [];
      let circlePaths = paper.project.getItems({ recursive: true }).filter(i => i.type === 'circle').map(c => {
        const path = c.toPath();
        c.remove();
        return path;
      });
      paper.project.getItems({ recursive: true, class: paper.Path }).forEach(item => {
        points = points.concat(item.segments.map(s => [s.point.x, s.point.y]));

        circlePaths.forEach(c => {
          const crossings = item.getCrossings(c);
          if(crossings.length <= 0) return;

          const crossing = crossings[0];

          if(c.contains(item.firstSegment.point))
            item.firstSegment.point = crossing.point;
          else
            item.lastSegment.point = crossing.point;
        });
      }, null)

      // add circle paths to point cloud so they don't get clipped
      circlePaths.forEach(circlePath => {
        circlePath.scale(1.1);

        ["topLeft", "topRight", "bottomLeft", "bottomRight"].forEach(prop => points.push([circlePath.bounds[prop].x, circlePath.bounds[prop].y]));
        for(let i=0 ; i < CIRCLE_BOUNDARY_DETAIL ; i++) {
          const p = circlePath.getPointAt(Math.floor(i / CIRCLE_BOUNDARY_DETAIL) * circlePath.length);
          points.push([p.x, p.y]);
        }
      });

      // generate and add hull
      const hullPath = new paper.Path();
      hullPath.strokeColor = 'red';
      concaveman(points, Infinity, 0).forEach(([x, y]) => hullPath.add(new paper.Point(x, y)));

      // add label
      const longestCurve = hullPath.curves.reduce((a, c) => !a || c.length > a.length ? c : a, null);
      const longestCurveCenter = longestCurve.getPointAt(longestCurve.length / 2);
      const tan = longestCurve.getTangentAt(longestCurve.length / 2);

      const label = new paper.PointText(longestCurveCenter);
      label.justification = 'center';
      label.fillColor = 'black';
      label.content = getMolecularFormula(sdf);
      label.rotate(tan.angle);

      svg = paper.project.exportSVG({ asString: true });

      fs.writeFileSync(`./out/${id}.svg`, svg);
      console.log("remaining:", outstanding);

      fetchAndDrawCompond(outstanding, cb, ids);
    });
  });
}

const subscripts = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉" ];
function getMolecularFormula(sdf) {
  const f = sdf.match(/<PUBCHEM_MOLECULAR_FORMULA>([^<]+)>/)[1].trim();
  return f.split('').map(c => !isNaN(Number(c)) ? subscripts[Number(c)] : c).join('');
}

function removeHulls(filename) {
  paper.project.importSVG(filename, {
    onLoad: function(item) {
      const hulls = paper.project.getItems({
        strokeColor: "red",
      });
      hulls.forEach(h => h.remove());

      svg = paper.project.exportSVG({ asString: true });
      fs.writeFileSync(`./out.svg`, svg);
    },
    onError: function(message) {
        console.error(message);
    }
  });
}

const mode = process.argv[2];

if(mode === "generate-rand") {
  fetchAndDrawCompond(process.argv[3] || 10, () => {
    console.log("all done!");
  });
} else if(mode === "generate") {
  const ids = process.argv.slice(3);
  fetchAndDrawCompond(0, () => {
    console.log("all done!");
  }, ids);
} else if(mode == "clean")
  removeHulls(process.argv[3] || "./nested.svg");
else
  console.log("usage : mode (generate, clean) option");
