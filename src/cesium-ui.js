import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "../src/css/main.css";
import "../src/cesium-ui";
import "../src/lib/jquery-ui-1.12.1.custom/jquery-ui.min.js";
import "../src/lib/jquery-3.3.1.min.js";
import "../src/lib/jquery-ui-1.12.1.custom/jquery-ui.css";
import "../src/cesium-ui.css";
//import proj4 from "../src/lib/proj4.js";
import proj4 from "proj4";
//import ol from "../src/lib/ol/ol.js";
import * as ol from "ol";
import "../src/cesium-ui.js";
import $ from "jquery";
import WMSCapabilities from "ol/format/WMSCapabilities.js";

//Cesium.Ion.defaultAccessToken = '';

var CesiumUI = {
  viewer: null,
  cameraMoving: false,
  views: {},
  config: {
    id: "default",
    name: "Maquette Antibes",
    // extent (degrees)
    extent: [7.057, 43.54, 7.146, 43.627],
    clock: {
      currentTime: "2019-07-01T11:00:00.00Z",
    },
    options: {
      displayPosition: false,
      depthTestAgainstTerrain: false,
      displayConsole: false,
    },
    views: {
      antibes: {
        name: "Antibes",
        destination: [4605135.76386452, 574914.9092524701, 4373867.371009422],
        orientation: {
          heading: 6.283185307179586,
          pitch: -0.7870703161505075,
          roll: 6.283185307179586,
        },
      },
      antibes_centre: {
        name: "Centre",
        destination: [4592113.451525292, 574445.367525959, 4374454.623695505],
        orientation: {
          heading: 5.425059983218845,
          pitch: -0.4521988345390495,
          roll: 6.280361263179284,
        },
      },
      fort_carre: {
        name: "Fort Carré",
        destination: [4591491.266512864, 574128.7943305084, 4375245.716108861],
        orientation: {
          heading: 6.283185307179586,
          pitch: -0.7870703146044944,
          roll: 6.283185307179586,
        },
      },
    },
    default_view: "antibes_centre",
    terrain: {
      type: "CesiumTerrainProvider",
      url: "//cesium-dev.ville-antibes.fr/tilesets/quantized/",
    },
    imagery: {
      type: "WebMapServiceImageryProvider",
      url: "//cesium-dev.ville-antibes.fr/geoserver/extranet/wms",
      layers: "extranet:Antibes_OrthoVraie_LB93_2017_withmask",
    },
    wmsServiceURLs: [
      { name: "Geoserver SIG", url: "//sig.ville-antibes.fr/geoserver/wms" },
      {
        name: "Mapserver Vues aériennes",
        url: "//sig.ville-antibes.fr/cgi-bin/mapserv-sig",
      },
      {
        name: "Geoserver Test",
        url: "//sig-test.ville-antibes.fr/geoserver/wms",
      },
    ],
    adresseURL: "//sig-test.ville-antibes.fr/adresses/",
  },
};

var viewer;
var scene;
var camera;
var config;
var sidebarWidth = "250px";
var displayPosition = false;
var positionHtmlNode;
var northHtmlElem;

// var defaultImageryProvider = new Cesium.TileMapServiceImageryProvider({
//     url : Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
// });

var defaultImageryProvider = new Cesium.ImageryLayer.fromProviderAsync(
  Cesium.TileMapServiceImageryProvider.fromUrl(
    Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII")
  )
);

var onView = null;

var adresseURL = CesiumUI.config.adresseURL;

var data_path = "https://cesium-dev.ville-antibes.fr/cesium/data";
var data2_path = "https://cesium-dev.ville-antibes.fr/cesium/data2";

var pinBuilder = new Cesium.PinBuilder();

var tooltip;

/* Imagery Layers */
var imageryLayers;
var baseLayers;
var imageryViewModel;
var wmsLayers;

var wmsServiceURL = null;

var ko = Cesium.knockout;

function log(content) {
  console.log(content);
  var logger = document.querySelector("#console");
  if (logger) {
    logger.innerHTML += content + "\n";
    logger.scrollTo(0, logger.scrollHeight);
  }
}

function addBaseLayerOption(name, imageryProvider) {
  var layer;
  if (typeof imageryProvider === "undefined") {
    layer = imageryLayers.get(0);
    imageryViewModel.selectedLayer = layer;
  } else {
    layer = new Cesium.ImageryLayer(imageryProvider);
  }

  layer.name = name;
  baseLayers.push(layer);
}
function addAdditionalLayerOption(name, imageryProvider, alpha, show) {
  var layer = imageryLayers.addImageryProvider(imageryProvider);
  layer.alpha = Cesium.defaultValue(alpha, 0.5);
  layer.show = Cesium.defaultValue(show, true);
  layer.name = name;
  Cesium.knockout.track(layer, ["alpha", "show", "name"]);
}

function updateLayerList() {
  var numLayers = imageryLayers.length;
  imageryViewModel.layers.splice(0, imageryViewModel.layers.length);
  for (var i = numLayers - 1; i >= 0; --i) {
    imageryViewModel.layers.push(imageryLayers.get(i));
  }
}

var selectionEntities = [];

function removeSelection() {
  for (var i = 0; i < selectionEntities.length; i++) {
    viewer.entities.remove(selectionEntities[i]);
  }
  selectionEntities = [];
}

function CanvasToolTip(canvas, timeout) {
  var me = this, // self-reference for event handlers
    div = document.createElement("div"), // the tool-tip div
    parent = canvas.parentNode, // parent node for canvas
    visible = false; // current status

  // set some initial styles, can be replaced by class-name etc.
  div.className = "canvasToolTip";
  //div.innerHTML = tooltip_text;

  // show the tool-tip
  this.show = function (pos) {
    if (!visible) {
      // ignore if already shown (or reset time)
      visible = true; // lock so it's only shown once
      setDivPos(pos); // set position
      parent.appendChild(div); // add to parent of canvas
      if (timeout > 0) setTimeout(hide, timeout); // timeout for hide
    }
  };

  this.setText = function (content) {
    if (div.innerHTML != content) div.innerHTML = content;
  };

  // hide the tool-tip
  function hide() {
    if (visible) {
      visible = false;
      parent.removeChild(div);
    }
  }

  // check mouse position
  function check(e) {
    var pos = getPos(e);
    if (!visible && div.innerHTML) {
      me.show(pos); // show tool-tip at this pos
    } else if (div.innerHTML) {
      setDivPos(pos);
    } else if (visible) hide();
  }

  // get mouse position relative to canvas
  function getPos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // update and adjust div position if needed (anchor to a different corner etc.)
  function setDivPos(pos) {
    if (visible) {
      if (pos.x < 0) pos.x = 0;
      if (pos.y < 0) pos.y = 0;
      // other bound checks here
      div.style.left = pos.x + "px";
      div.style.top = pos.y + "px";
    }
  }
  me.setText("");

  // Event handlers:
  canvas.addEventListener("mousemove", check);
  canvas.addEventListener("mouseout", hide);
  canvas.addEventListener("click", check);
}

function CanvasTextLabel(canvas) {
  var me = this, // self-reference for event handlers
    div = document.createElement("div"), // the tool-tip div
    parent = canvas.parentNode, // parent node for canvas
    visible = false; // current status

  div.className = "canvasTextLabel";

  // show the tool-tip
  this.show = function (pos) {
    if (!visible) {
      // ignore if already shown (or reset time)
      visible = true; // lock so it's only shown once
      parent.appendChild(div); // add to parent of canvas
    }
    setDivPos(pos); // set position
  };

  this.setText = function (content) {
    if (div.innerHTML != content) div.innerHTML = content;
  };

  // hide the tool-tip
  function hide() {
    if (visible) {
      visible = false;
      parent.removeChild(div);
    }
  }

  function setDivPos(pos) {
    if (visible) {
      div.style.left = pos.x + "px";
      div.style.top = pos.y + "px";
    }
  }
  me.setText("LABEL");
}

function openNav() {
  document.getElementById("sidenav").style.width = sidebarWidth;
  document.getElementById("cesiumContainer").style.marginLeft = sidebarWidth;
}
///!\ Add event handler on openNav button
const openNavButton = document.getElementById("openNav");
openNavButton.addEventListener("click", openNav);

function closeNav() {
  document.getElementById("sidenav").style.width = "0";
  document.getElementById("cesiumContainer").style.marginLeft = "0";
}

///!\ Add event handler on CloseNav button
const closeNavButton = document.getElementById("closeNav");
closeNavButton.addEventListener("click", closeNav);

function displayCameraPosition() {
  positionHtmlNode.nodeValue =
    "" +
    Cesium.Math.toDegrees(camera.positionCartographic.longitude).toFixed(6) +
    "° " +
    Cesium.Math.toDegrees(camera.positionCartographic.latitude).toFixed(6) +
    "°  H: " +
    camera.positionCartographic.height.toFixed(1) +
    " m";
}
function enableDisplayPosition(enable) {
  /* Initialisation outil de position de la caméra */
  if (!displayPosition && !positionHtmlNode) {
    var positionElem = document.createElement("div");
    positionElem.id = "infos-position";
    viewer.canvas.parentNode.appendChild(positionElem);
    if (positionElem) {
      positionHtmlNode = document.createTextNode("");
      positionElem.appendChild(positionHtmlNode);
    }
  }
  if (positionHtmlNode) {
    displayPosition = enable;
    if (enable) {
      displayCameraPosition();
    } else {
      positionHtmlNode.nodeValue = "";
    }
  }
}
function updateNorthArrow() {
  northHtmlElem.style.transform = "rotate(" + -viewer.camera.heading + "rad)";
}
function northOrientation() {
  camera.setView({
    orientation: {
      heading: 0,
      pitch: camera.pitch,
      roll: camera.roll,
    },
  });
}

function showViewer() {
  // Add Lambert93
  proj4.defs([
    [
      "EPSG:2154",
      "+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
    ],
  ]);

  var extent = Cesium.Rectangle.fromDegrees(
    CesiumUI.config.extent[0],
    CesiumUI.config.extent[1],
    CesiumUI.config.extent[2],
    CesiumUI.config.extent[3]
  );
  Cesium.Camera.DEFAULT_VIEW_RECTANGLE = extent;
  Cesium.Camera.DEFAULT_VIEW_FACTOR = 0;

  var terrain = new Cesium.CesiumTerrainProvider({
    url: CesiumUI.config.terrain.url,
  });
  var clock = new Cesium.Clock({
    currentTime: Cesium.JulianDate.fromIso8601(
      CesiumUI.config.clock.currentTime
    ),
    shouldAnimate: false,
  });

  $.each(CesiumUI.config.views, function (key, val) {
    CesiumUI.views[key] = {
      name: val.name,
      destination: Cesium.Cartesian3.fromArray(val.destination),
      orientation: {
        heading: val.orientation.heading,
        pitch: val.orientation.pitch,
        roll: val.orientation.roll,
      },
    };
  });

  CesiumUI.viewer = new Cesium.Viewer("cesiumContainer", {
    clockViewModel: new Cesium.ClockViewModel(clock),
    imageryProvider: defaultImageryProvider,
    terrainProvider: terrain,
    baseLayerPicker: false,
    geocoder: false,
    animation: false,
    timeline: false,
    projectionPicker: false,
    sceneModePicker: false,
    infoBox: false,
    selectionIndicator: false,
    scene3DOnly: true,
    useBrowserRecommendedResolution: true,
    //requestRenderMode : true,
    //maximumRenderTimeChange : Infinity
  });
  viewer = CesiumUI.viewer;
  viewer.resolutionScale = 1.0;
  viewer.scene.sunBloom = false;
  viewer.scene.fog.enabled = false;
  viewer.terrainShadows = false;
  console.log(viewer);
  viewer.imageryLayers.get(0).name = "Natural Earth";
  scene = viewer.scene;
  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
    Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
  );
  scene.debugShowFramesPerSecond = false;
  scene.globe.depthTestAgainstTerrain =
    CesiumUI.config.options.depthTestAgainstTerrain;
  scene.postProcessStages.fxaa.enabled = true;

  camera = viewer.camera;

  if (CesiumUI.config.default_view)
    camera.setView(CesiumUI.views[CesiumUI.config.default_view]);

  if ($("#north-arrow")) {
    northHtmlElem = $("#north-arrow")[0];
    $(northHtmlElem).on("click", function () {
      northOrientation();
    });
  }

  /* Paramètres */
  var options_dialog = $("#options-form").dialog({
    autoOpen: false,
    //height: 400,
    width: 300,
    modal: false,
  });

  $("#open-options").on("click", function () {
    options_dialog.dialog("open");
  });

  $("#checkbox-hq").prop("checked", scene.postProcessStages.fxaa.enabled);
  $("#checkbox-hq").on("change", function () {
    scene.postProcessStages.fxaa.enabled = this.checked;
    scene.requestRender();
  });

  $("#checkbox-fps").on("change", function () {
    if (this.checked) {
      scene.debugShowFramesPerSecond = true;
    } else {
      scene.debugShowFramesPerSecond = false;
    }
  });

  $("#checkbox-display-position").on("change", function () {
    enableDisplayPosition(this.checked);
  });

  $("#checkbox-depthTestAgainstTerrain").prop(
    "checked",
    CesiumUI.config.options.depthTestAgainstTerrain
  );
  $("#checkbox-depthTestAgainstTerrain").on("change", function () {
    if (scene.globe.depthTestAgainstTerrain != this.checked)
      scene.globe.depthTestAgainstTerrain = this.checked;
  });

  $("#checkbox-inspector").on("change", function () {
    if (this.checked) {
      if (!viewer.cesiumInspector)
        viewer.extend(Cesium.viewerCesiumInspectorMixin);
      else $(".cesium-viewer-cesiumInspectorContainer").show();
    } else $(".cesium-viewer-cesiumInspectorContainer").hide();
  });

  $("#checkbox-3DTilesInspector").on("change", function () {
    if (this.checked) {
      if (!viewer.cesium3DTilesInspector)
        viewer.extend(Cesium.viewerCesium3DTilesInspectorMixin);
      else $(".cesium-viewer-cesium3DTilesInspectorContainer").show();
    } else $(".cesium-viewer-cesium3DTilesInspectorContainer").hide();
  });
  $("#checkbox-display-console").on("change", function () {
    if (this.checked) {
      $("#console").show();
    } else {
      $("#console").hide();
    }
  });

  /* Imagery Layers Panel */

  imageryLayers = viewer.imageryLayers;
  imageryViewModel = {
    layers: [],
    baseLayers: [],
    upLayer: null,
    downLayer: null,
    selectedLayer: null,
    isSelectableLayer: function (layer) {
      return this.baseLayers.indexOf(layer) >= 0;
    },
    raise: function (layer, index) {
      imageryLayers.raise(layer);
      imageryViewModel.upLayer = layer;
      imageryViewModel.downLayer =
        imageryViewModel.layers[Math.max(0, index - 1)];
      updateLayerList();
      window.setTimeout(function () {
        imageryViewModel.upLayer = imageryViewModel.downLayer = null;
      }, 10);
    },
    lower: function (layer, index) {
      imageryLayers.lower(layer);
      imageryViewModel.upLayer =
        imageryViewModel.layers[
          Math.min(imageryViewModel.layers.length - 1, index + 1)
        ];
      imageryViewModel.downLayer = layer;
      updateLayerList();
      window.setTimeout(function () {
        imageryViewModel.upLayer = imageryViewModel.downLayer = null;
      }, 10);
    },
    remove: function (layer, index) {
      imageryLayers.remove(layer, true);
      updateLayerList();
    },
    canRaise: function (layerIndex) {
      return layerIndex > 0;
    },
    canLower: function (layerIndex) {
      return layerIndex >= 0 && layerIndex < imageryLayers.length - 1;
    },
    canRemove: function (layer) {
      return this.baseLayers.indexOf(layer) < 0;
    },
    canQuery: function (layer) {
      return (
        layer.imageryProvider instanceof Cesium.WebMapServiceImageryProvider
      );
    },
  };
  baseLayers = imageryViewModel.baseLayers;

  Cesium.knockout.track(imageryViewModel);

  addBaseLayerOption(imageryLayers.get(0).name, undefined);
  updateLayerList();

  //Bind the viewModel to the DOM elements of the UI that call for it.
  var toolbarLayers = document.getElementById("imagery-layers");
  Cesium.knockout.applyBindings(imageryViewModel, toolbarLayers);

  Cesium.knockout
    .getObservable(imageryViewModel, "selectedLayer")
    .subscribe(function (baseLayer) {
      // Handle changes to the drop-down base layer selector.
      var activeLayerIndex = 1;
      var numLayers = imageryViewModel.layers.length;
      for (var i = 1; i < numLayers; ++i) {
        if (imageryViewModel.isSelectableLayer(imageryViewModel.layers[i])) {
          activeLayerIndex = i;
          break;
        }
      }
      var activeLayer = imageryViewModel.layers[activeLayerIndex];
      var show = activeLayer.show;
      var alpha = activeLayer.alpha;
      imageryLayers.remove(activeLayer, false);
      imageryLayers.add(baseLayer, numLayers - activeLayerIndex - 1);
      baseLayer.show = show;
      baseLayer.alpha = alpha;
      updateLayerList();
    });

  var imageryDialog = $("#imagery-layers-dialog").dialog({
    autoOpen: false,
    width: 400,
    modal: false,
  });

  $("#open-imagerylayers").on("click", function () {
    imageryDialog.dialog("open");
  });

  if (CesiumUI.config.wmsServiceURLs.length > 0)
    wmsServiceURL = CesiumUI.config.wmsServiceURLs[0].url;

  var wmsSelectionViewModel = {
    optionValues: CesiumUI.config.wmsServiceURLs,
    selectedOptionValue: ko.observable(wmsServiceURL),
  };

  var wmsSelectionFormElement = document.getElementById("wms-form");
  ko.applyBindings(wmsSelectionViewModel, wmsSelectionFormElement);

  function addWMSLayer() {
    var wmsUrl = $("#wms-url").val();
    var wmsLayers = $("#wms-layer").val();
    var wmsName = $("#wms-name").val();
    var wmsProvider = new Cesium.WebMapServiceImageryProvider({
      url: wmsUrl,
      layers: wmsLayers,
      enablePickFeatures: false,
      parameters: {
        transparent: "true",
        format: "image/png",
      },
    });
    addAdditionalLayerOption(wmsName, wmsProvider, 1.0, true);
    updateLayerList();
    newWMSDialog.dialog("close");
  }

  var newWMSDialog = $("#wms-form").dialog({
    autoOpen: false,
    width: 500,
    modal: true,
    buttons: {
      "Ajouter la couche": addWMSLayer,
      Cancel: function () {
        newWMSDialog.dialog("close");
      },
    },
  });

  $("#open-wms-form").on("click", function () {
    newWMSDialog.dialog("open");
  });

  ///!\break change version between ol 3 and ol 7 (new install 08/2023)
  //var wmsParser = new ol.format.WMSCapabilities();
  var wmsParser = new WMSCapabilities();

  function updateWMSLayers() {
    var capabilitiesUrl =
      wmsServiceURL + "?service=WMS&request=GetCapabilities";
    $.ajax({
      type: "GET",
      url: capabilitiesUrl,
      async: true,
      cache: false,
      success: function (response, textStatus, jQxhr) {
        var result = wmsParser.read(jQxhr.responseText);
        var json = window.JSON.stringify(result, null, 2);
        var obj = JSON.parse(json);
        wmsLayers = obj.Capability.Layer.Layer;
        wmsLayers.sort(function (a, b) {
          if (a.Title.toLowerCase() < b.Title.toLowerCase()) return -1;
          if (a.Title.toLowerCase() > b.Title.toLowerCase()) return 1;
          return 0;
        });
        //console.log(wmsLayers);
        $.each(wmsLayers, function (i, item) {
          if (item.Name != "antibes:dgi_cad_parcelles") {
            $("#wms-layer-select").append(
              $("<option>", {
                value: i,
                text: item.Title,
              })
            );
          }
        });
      },
      error: function (jqXhr, textStatus, errorThrown) {
        alert("error");
        alert(jqXhr.responseText);
        alert(textStatus);
        alert(errorThrown);
      },
    });
  }
  updateWMSLayers();
  $("#wms-url").on("change", function () {
    wmsServiceURL = wmsSelectionViewModel.selectedOptionValue();
    $("#wms-layer").val("");
    $("#wms-name").val("");
    $("#wms-layer-select").html('<option value="-1">Sélectionner ...</option>');
    updateWMSLayers();
  });
  $("#wms-layer-select").on("change", function () {
    var wmsSelectedIndex = $("#wms-layer-select").val();
    if (wmsSelectedIndex >= 0) {
      $("#wms-layer").val(wmsLayers[wmsSelectedIndex].Name);
      $("#wms-name").val(wmsLayers[wmsSelectedIndex].Title);
    }
  });

  if (onView != null) onView();

  if (window.innerWidth > 500) openNav();

  if (CesiumUI.config.options.displayConsole) {
    $("#checkbox-display-console").prop("checked", true);
    $("#console").show();
  }
  if (CesiumUI.config.options.displayPosition) {
    enableDisplayPosition(true);
    displayPosition = true;
    //displayCameraPosition();
    $("#checkbox-display-position").prop("checked", true);
  }

  /** ZOOM EVENTS **/
  var canvas = viewer.canvas;
  var ellipsoid = scene.globe.ellipsoid;
  var flags = {
    moveForward: false,
    moveBackward: false,
  };
  $("#zoom-in").mousedown(function (e) {
    if (e.which === 1) {
      flags["moveForward"] = true;
    }
  });
  $("#zoom-in").mouseup(function (e) {
    if (e.which === 1) {
      flags["moveForward"] = false;
    }
  });
  $("#zoom-out").mousedown(function (e) {
    if (e.which === 1) {
      flags["moveBackward"] = true;
    }
  });
  $("#zoom-out").mouseup(function (e) {
    if (e.which === 1) {
      flags["moveBackward"] = false;
    }
  });
  $("#zoom-in").on("touchstart", function () {
    flags["moveForward"] = true;
  });
  $("#zoom-in").on("touchend", function () {
    flags["moveForward"] = false;
  });
  $("#zoom-out").on("touchstart", function () {
    flags["moveBackward"] = true;
  });
  $("#zoom-out").on("touchend", function () {
    flags["moveBackward"] = false;
  });
  camera.moveStart.addEventListener(function (clock) {
    CesiumUI.cameraMoving = true;
  });
  camera.moveEnd.addEventListener(function (clock) {
    CesiumUI.cameraMoving = false;
  });
  viewer.clock.onTick.addEventListener(function (clock) {
    // Change movement speed based on the distance of the camera to the surface of the ellipsoid.
    if (CesiumUI.cameraMoving || flags.moveForward || flags.moveBackward) {
      var cameraHeight = ellipsoid.cartesianToCartographic(
        camera.position
      ).height;
      var moveRate = cameraHeight / 20.0;
      if (flags.moveForward) {
        camera.moveForward(moveRate);
      }
      if (flags.moveBackward) {
        camera.moveBackward(moveRate);
      }
      updateNorthArrow();
      if (displayPosition) {
        displayCameraPosition();
      }
    }
  });

  tooltip = new CanvasToolTip(viewer.canvas, 0);

  // Create info dialog element
  var divInfosDialog = document.createElement("div");
  divInfosDialog.id = "infos-dialog";
  document.body.appendChild(divInfosDialog);

  var divWMSResultDialog = document.createElement("div");
  divWMSResultDialog.id = "wms-result-dialog";
  divWMSResultDialog.title = "Résultat imagerie WMS";
  divWMSResultDialog.innerHTML = '<div id="wms-result"></div>';
  document.body.appendChild(divWMSResultDialog);

  var preConsole = document.createElement("pre");
  preConsole.id = "console";
  document.body.appendChild(preConsole);

  var divCoordinatesDialog = document.createElement("div");
  divCoordinatesDialog.id = "dialogCoordinates";
  divCoordinatesDialog.title = "Coordonnées";
  divCoordinatesDialog.innerHTML =
    '<div>Lon: <span id="dialog-coords-lon"></span> ° / <span id="dialog-coords-lon-rad"></span> rad</div>';
  divCoordinatesDialog.innerHTML +=
    '<div>Lat: <span id="dialog-coords-lat"></span> ° / <span id="dialog-coords-lat-rad"></span> rad</div>';
  divCoordinatesDialog.innerHTML +=
    '<div>Lambert93: <span id="dialog-coords-L93-x"></span>, <span id="dialog-coords-L93-y"></span></div>';
  divCoordinatesDialog.innerHTML +=
    '<div>Hauteur: <span id="dialog-coords-height"></span> m</div>';
  document.body.appendChild(divCoordinatesDialog);

  updateViewsToolbar();
}

function updateViewsToolbar() {
  var html = '<div class="row">';
  for (var viewID in CesiumUI.views) {
    html +=
      '<input id="goto_' +
      viewID +
      '" class="cesium-button" type="button" value="' +
      CesiumUI.views[viewID].name +
      '"/>';
  }
  html += "</div>";
  $("#toolbar-positions").html(html);

  for (var viewID in CesiumUI.views) {
    //$('#goto_'+viewID).click({"viewID":viewID}, gotoView);
    $("#goto_" + viewID).on("click", { viewID: viewID }, gotoView);
  }
}

function gotoView(e) {
  var viewID = e.data.viewID;
  if (viewID) camera.setView(CesiumUI.views[viewID]);
}

///!\ Minor change Jquery version
// $(document).change(function () {
//   $(document).bind("contextmenu", function (e) {
//     return false;
//   });
//   showViewer();
// });
$(function() {
	$(document).on("contextmenu", function(e) {
	  return false;
	});
	showViewer();
  });
