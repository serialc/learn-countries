"use strict";

var LC = {
  "game": {
    "state": 0,
    "last_code": '',
    "score": 0,
    "type": '',
    "qnum": 0,
    "csets": {
      1: ['FRA', 'DEU', 'GBR', 'DNK', 'BEL', 'NLD', 'LUX', 'IRL', 'ESP', 'PRT', 'CHE', 'MCO'],
      2: ['ISL', 'NOR', 'SWE', 'FIN', 'EST', 'LVA', 'LTU', 'RUS', 'BLR', 'UKR', 'POL', 'CZE', 'GEO'],
      3: ['SVK', 'HUN', 'SVN', 'HRV', 'SRB', 'BIH', 'ROU', 'MDA', 'BGR', 'MKD', 'AUT'],
      4: ['AND', 'LIE', 'VAT', 'MNE', 'KOS', 'ALB', 'GRC', 'ITA', 'SMR', 'TUR', 'MLT', 'ARM'],
      5: [] // populated automatically from sets 1-4
    },
    "active_set":[]
  },
  "f": {},
  "settings": {
    "language": 'fr',
    "interval_ms": 2500,
    "width": 800,
    "height": 600
  },
  "tools": {},
  "data": {}
};

LC.f.onload = function() {

  // reset the game GUI
  LC.f.reset_game();

  // build the 'all sets' set
  LC.game.csets[5] = LC.game.csets[1].concat(LC.game.csets[2]).concat(LC.game.csets[3]).concat(LC.game.csets[4]);

  // setup the map
  // define projection
  //LC.settings.projectino = d3.geoEqualEarth()
  /*LC.settings.projection = d3.geoAlbers()
    .scale(800)
    //.translate([450,250])
    .rotate([-25, -15, 0]);
  */
  LC.settings.projection = d3.geoMercator()
    .center([ 13, 52 ])
    .translate([ LC.settings.width/2, LC.settings.height/2 ])
    .scale([ LC.settings.width/1.3 ]);

  // define GCS to PCS generator using projection
  LC.tools.pathGen = d3.geoPath()
    .projection(LC.settings.projection);

  // zooming settings
  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on('zoom', function() {
      LC.data.svg.select('g').attr('transform', d3.event.transform);
  });

  // retrieve html element to build map in - generate some basics
  LC.data.svg = d3.select('#map_display')
    .append('svg')
      .attr('viewBox', '0 0 ' + LC.settings.width + ' ' + LC.settings.height);
      //.attr('width', LC.settings.width)
      //.attr('height', LC.settings.height);

  let g = LC.data.svg.append('g');
  g.append('g')
    .attr('id', 'countries')
  g.append('g')
    .attr('id', 'capitals');

  LC.data.svg.call(zoom);

  // runs once the data is available
  d3.json("data/world.json",
    function(error, geojson) {
      if (error) return console.error(error);

      // bind the data to the svg
      let cgeomlist = LC.data.svg.select('#countries')
        .selectAll('path')
        .data(geojson.features);

      // enter each item in list, give it attribute 'd'/path
      cgeomlist.enter()
        .append('path')
          .attr('d', LC.tools.pathGen)
          .attr('class', function(d){ return d.properties.continent.replace(' ', '_'); })
          .attr('id', function(d){ return 'cb_' + d.properties.adm0_a3; })
          .on("mousedown", function(d) { LC.f.mouse_down(d.properties.adm0_a3) })
          .on("click",     function(d) { LC.f.mouse_up(d.properties.adm0_a3) });

      //LC.data.svg.select('#countries').selectAll('path')
      //.data(geojson.features);

      LC.data.bounds = geojson;

    }
  );

  fetch("data/french.csv")
    .then(function(response) {
      return response.text();
    })
    .then(function(text) {
      text = text.split('\r');

      // transform each line into object
      // use 3 lettre code as assoc. array key
      // store FR object, with country,capital
      let translate = {};

      let header = true;
      for(let line in text) {
        if( header ) {
          header = false;
          continue;
        }

        // get line parts
        let p = text[line].split(';'); 

        //NOM;NOM_ALPHA;CODE;ARTICLE;NOM_LONG;CAPITALE
        //Afghanistan;Afghanistan;AFG;l';République islamique d'Afghanistan;Kaboul
        let country = p[0].replace(/(\r\n|\n|\r)/gm,"");
        let article = p[3];
        article = article == "l'" ? article : article + ' ';
        translate[p[2]] = {"fr": {"country":article+country, "capital":p[5], "plural": article == 'les '}};
      }
      LC.data.translate = translate;
    });
  fetch("data/capitals.csv")
    .then(function(response) {
      return response.text();
    })
    .then(function(text) {
      text = text.split('\n');

      let capitals = {
        "type": "FeatureCollection",
        "features": [] };

      let header = true;
      for(let line in text) {
        
        // skip header line
        if( header ) {
          header = false;
          continue;
        }

        // skip commented out capitals
        if( text[line][0] == '#' ) {
          continue;
        }

        let p = text[line].split(','); 

        // Country,Capital,Latitude,Longitude,COD3
        let point = {
          "type": "Feature",
          "geometry": {
            "type": "Point",
            "coordinates": [p[3], p[2]]
          },
          "properties": {
            "code": p[4],
            "country": p[0],
            "capital": p[1]
          }
        };

        capitals.features.push(point);
      }
      
      LC.data.capitals = capitals;

      let cgeomlist = LC.data.svg.select('#capitals')
        .selectAll('path')
        .data(capitals.features);

      cgeomlist.enter()
        .append('path')
          .attr('d', LC.tools.pathGen)
          //.attr('val', function(d) { return d.properties.capital })
          .attr('id', function(d){ return 'cc_' + d.properties.code; })
          .attr('class', 'capital')
        .on("mousedown", function(d) { LC.f.mouse_down(d.properties.code) })
        .on("click",     function(d) { LC.f.mouse_up(d.properties.code) });
    });
};

LC.f.mouse_down = function() { LC.data.mouse = performance.now(); };

LC.f.mouse_up = function(code) {
  if( (performance.now() - LC.data.mouse) < 600 ) {
    LC.f.country_click(code);
  }
};

LC.f.country_click = function(code) {
  console.log(code);
  LC.f.game_eval_answer(code);
};

LC.f.set_game_type = function(game_type) {
  // save to global
  LC.game.type = game_type;

  // hide/show GUI
  document.getElementById('select_game').style.display = 'none';
  document.getElementById('select_set').style.display = '';

  if( game_type == 'find_country') {
    document.getElementById('game_description').innerHTML = '<h4>Instructions</h4><p>Cliquez sur le pays demand&eacute;.</p>';
  }
  if( game_type == 'find_capital') {
    document.getElementById('game_description').innerHTML = '<h4>Instructions</h4><p>Cliquez sur la capitale ou le pays de la capitale demand&eacute;.</p>';
  }
  if( game_type == 'name_country') {
    document.getElementById('game_description').innerHTML = '<h4>Instructions</h4><p>Selectionez le nom du pays color&eacute;.';
  }
  if( game_type == 'name_capital') {
    document.getElementById('game_description').innerHTML = '<h4>Instructions</h4><p>Selectionez le nom de la capital color&eacute;.';
  }
};

LC.f.set_game_countries = function(set_num) {
  LC.game.active_set = LC.f.shuffle(LC.game.csets[set_num]);
  document.getElementById('select_set').style.display = 'none';
  document.getElementById('select_start').style.display = '';
  document.getElementById('start_button').style.display = '';
}

LC.f.start_game = function() {
  // clear ui
  document.getElementById('start_button').style.display = 'none';

  LC.f.game_ask_question()
}

LC.f.game_eval_answer = function(code) {

  // check we're only evaluating if the game has started
  if( LC.game.type == 0 || LC.game.state == 0) {
    let selected = LC.f.decode(code);
    LC.f.msg("C'est " + selected['country'] + " (" + selected['capital'] + "), mais le jeux n'a pas commenc&eacute;.", 'i');
    return;
  }
  if( LC.game.state == 2 ) {
    console.log('game is paused');
    // waiting for user to press 'next', don't evaluate any map clicks
    return;
  }

  // evaluate answer
  let correct = LC.game.active_set[LC.game.qnum];
  let country = LC.f.decode(correct);
  
  // move pointer to next question
  LC.game.qnum += 1;

  if( correct == code ) {
    console.log('correct');
    LC.game.state = 2;

    if( LC.game.type == 'find_country' ) {
      if( country['plural'] ) {
        LC.f.feedback("<h4>C'est correct</h4><p class='alert alert-success' role='alert'>Ce sont " + country['country'] + ". La capitale est " + country['capital'] + ".</p>");
      } else {
        LC.f.feedback("<h4>C'est correct</h4><p class='alert alert-success' role='alert'>C'est " + country['country'] + ". La capitale est " + country['capital'] + ".</p>");
      }
    }
    if( LC.game.type == 'find_capital' ) {
      LC.f.feedback("<h4>C'est correct</h4><p class='alert alert-success' role='alert'>C'est " + country['capital'] + ", dans " + country['country'] + ".</p>");
    }

    LC.game.score += 1;
    setTimeout( function() {
      LC.game.state = 1;
      LC.f.game_ask_question();
    }, 3000 );
  } else {
    console.log('incorrect');
    LC.game.state = 2;
    LC.game.last_code = correct;
    if( LC.game.type == 'find_country' ) {
      LC.f.feedback("<h4 class='alert alert-danger' role='alert'>D&eacute;sol&eacute, c'est faux</h4>" + country['country'] + " (" + country['capital'] + ") est indiqu&eacute; sur la carte");
    }
    if( LC.game.type == 'find_capital' ) {
      LC.f.feedback("<h4 class='alert alert-danger' role='alert'>D&eacute;sol&eacute, c'est faux</h4>" + country['capital'] + " est dans " + country['country'] + ". C'est indiqu&eacute; sur la carte");
    }
    document.getElementById('cb_' + correct).style.fill = 'green';
    document.getElementById('cc_' + correct).style.fill = 'white';
    document.getElementById('select_next').style.display = '';
  }

  // if end of game
  if( LC.game.active_set.length == LC.game.qnum ) {
    // don't show next button if last question answered was wrong
    document.getElementById('select_next').style.display = 'none';
    document.getElementById('game_instructions').style.display = 'none';
    document.getElementById('game_description').style.display = 'none';
    LC.game.type = 0;
    document.getElementById('game_results').style.display = '';
    document.getElementById('game_results').innerHTML = '<h4>Vous avez eu ' + LC.game.score + '/' + LC.game.active_set.length + ' questions correctes.';
    document.getElementById('select_play_again').style.display = '';
  }
};

LC.f.game_ask_question = function() {
  LC.game.state = 1;

  // remove 'highlight' of correct answer that user got wrong
  if( LC.game.last_code != '' ) {
    document.getElementById('cb_' + LC.game.last_code).style.fill = '';
    document.getElementById('cc_' + LC.game.last_code).style.fill = '';
    LC.game.last_code = '';
  }

  // ask next question
  document.getElementById('game_feedback').style.display = 'none';
  document.getElementById('select_next').style.display = 'none';
  let country = LC.f.decode(LC.game.active_set[LC.game.qnum]);
  if( LC.game.type == 'find_country') {
    console.log(country['plural']);
    LC.f.instruct("Ou " + (country['plural'] ? "sont " : "est ") + country['country'] + '?');
  }
  if( LC.game.type == 'find_capital') {
    LC.f.instruct('Ou est ' + country['capital'] + '?');
  }
  if( LC.game.type == 'name_country') { }
  if( LC.game.type == 'name_capital') { }
};

LC.f.reset_game = function() {
  // game setup
  document.getElementById('select_game').style.display = '';
  document.getElementById('select_set').style.display = 'none';
  document.getElementById('select_start').style.display = 'none';
  document.getElementById('game_instructions').style.display = 'none';
  document.getElementById('game_description').style.display = '';
  document.getElementById('game_results').style.display = 'none';
  document.getElementById('select_next').style.display = 'none';
  document.getElementById('select_play_again').style.display = 'none';
  document.getElementById('game_feedback').style.display = 'none';
  // message boxes
  document.getElementById('smessaging').style.display = 'none';
  document.getElementById('imessaging').style.display = 'none';
  document.getElementById('emessaging').style.display = 'none';

  // reset data
  LC.game.score = 0;
  LC.game.qnum = 0;
}

LC.f.feedback = function(msg) {
  let el = document.getElementById('game_feedback');
  el.style.display = '';
  el.innerHTML = msg;
};
LC.f.instruct = function(msg) {
  let el = document.getElementById('game_instructions');
  el.style.display = '';
  el.innerHTML = '<h4>' + msg + '</h4>';
};

LC.f.msg = function(msg, type) {
  if( !['s','i','e'].includes(type) ) {
    this.msg("Failed to create message with correct type:" + msg, 'e');
    return;
  }

  let m = document.getElementById(type + 'messaging');
  m.style.display = '';
  m.innerHTML = msg;
  setTimeout(function(){m.style.display = 'none';},
    LC.settings.interval_ms);
};

LC.f.decode = function(code) {
  // get the country/capital names given a 3-lettre code
  return LC.data.translate[code][LC.settings.language];
};

LC.f.highlight_set = function(set_num) {
  let set = LC.game.csets[set_num];
  for(let i = 0; i < set.length; i+=1) {
    document.getElementById('cb_' + set[i]).style.fill = 'green';
    document.getElementById('cc_' + set[i]).style.fill = 'white';
  }
  setTimeout( function() {
    for(let i = 0; i < set.length; i+=1) {
      document.getElementById('cb_' + set[i]).style.fill = '';
      document.getElementById('cc_' + set[i]).style.fill = '';
    }
  }, 2000);
};

LC.f.shuffle = function(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

LC.f.onload();

