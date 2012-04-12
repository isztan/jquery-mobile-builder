$( function( $ ) {
	var host = "http://amd-builder.no.de",
		dependencyMap,
		builderhtml = [],
		sortable = [],
		groupBy = function( data, iterator ) {
			var res = {};

			_.each( _.uniq( _.map( data, iterator ) ), function( val ) {
				res[val] = {};
			});

			_.each( data, function( value, key, list ) {
				if ( value.group ) {
					res[ value.group ][ key ] = value;
				} else {
					res.Other[ key ] = value;
				}
			});
			return res;
		},
		module2domId = function( module ) {
			return module.replace( /\./g, '-' ).replace( /^(.)/, function( c ) { return c.toLowerCase(); } );
		},
		group2domId = function( group ) {
			return group.replace( / /g, '-' ).replace( /^(.)/, function( c ) { return c.toLowerCase(); } );
		},
		strip = function( file ) {
			return file.replace( /^\.\//g, '' ).replace( /\./g, '-' );
		},
		buildForm = function( data ) {
			var $form = $( "#builder" ).empty(),
				groupedComponents = groupBy( data, function( o ) {
					return ( o.group || "Other" );
				}),
				groups = _.keys( groupedComponents ).sort();

			_.forEach( groups, function( group ) {
				if ( group != "exclude" ) {
					var $group = $( "<ul>" ).attr( "id", group2domId( group ) ),
						catlength = 0,
						cat,
						components = _.keys( groupedComponents[ group ] ).sort();

					_.forEach( components, function( name ) {
						var id = module2domId( name ),
							label = data[ name ].label,
							desc = data[ name ].description,
							req = data[ name ].required,
							labelm = "<label for='" + id + "'>" + label + "</label>",
							inputm = "<input type='checkbox' class='inc' id='" + id + "' name='" + id + "'" + ( req ? " checked='checked' disabled='true'" : "") + "/>",
							descm = "<p class='desc'>" + desc + "</p>",
							item = inputm;

						if ( /^jquery\.mobile/.test( name ) ) {
							if ( label ) { item = item + labelm; }
							if ( desc ) { item = item + descm; }

							$group.append( "<li>" + item + "</li>" );
							catlength++;
						}
					});

					if( catlength ) {
						cat = $("<div class='group'></div>")
							.append( "<label class='select-all'> Select all <input type='checkbox' class='sel-all' name='select-all-" + group + "' /></label> <h3 class='hed-cat'>" + group + "</h3>" )
							.append( $group );

						$form.append( cat );
					}
				}
			});
			$form.append( '<input type="submit" value="Build My Download" class="buildBtn">' ).removeClass( "loading" );
		},
		buildCheckListFor = function( id, hash ) {
			var module = dependencyMap[ id ];
			hash = hash || {};
			if ( module && module.deps ) {
				_.each( module.deps, function( name, index ) {
					if ( !( name in hash) ) {
						hash[ name ] = true;
						buildCheckListFor( name, hash );
					}
				});
			}
			return _.keys( hash );
		},
		buildUncheckListFor = function( id, hash ) {
			hash = hash || {};
			_.each( dependencyMap, function( module, name ) {
				if ( !( name in hash ) ) {
					if ( _.indexOf( module.deps, id ) > -1 ) {
						hash[ name ] = true;
						buildUncheckListFor( name, hash );
					}
				}
			});
			return _.keys( hash );
		},
		resolveDependencies = function( e ) {
			var $el = $( e.target ),
				key, i,
				id = $el.attr( 'id' ).replace( /\-/g, '.' ),
				dep = dependencyMap[ id ],
				checked = $el.is( ':checked' ),
				list;

			if ( checked ) {
				list = buildCheckListFor( id );
				_.each( list, function( name ) {
					$( '#' + module2domId( name ) ).attr( 'checked', 'checked' );
				});
			} else {
				list = buildUncheckListFor( id );
				_.each( list, function( name ) {
					$( '#' + module2domId( name ) ).removeAttr( 'checked' );
				});
			}
		},
		selectAll = function( e ) {
			var $el = $( e.target ),
				elval = $el.prop( "checked" );

			$el.closest( ".group" ).find( "ul input:checkbox" ).prop( "checked", elval ).trigger( "change" );
		},
		refreshForm = function() {
			var branch = $( "#branch option:selected" ).val() || "master";
			$.ajax( host + '/v1/dependencies/jquery/jquery-mobile/' + branch + '/?baseUrl=js' ).done(
				function( data ) {
					dependencyMap = data;
					// Clean up deps attr from relative paths and plugins
					_.each( dependencyMap, function( value, key, map ) {
						if ( value.group && value.group === "exclude" ) {
							delete map[ key ];
						} else if ( value.deps ) {
							_.each( value.deps, function( v, k, m ) {
								m[ k ] = m[ k ].replace( /^.*!/, "" );  // remove the plugin part
								m[ k ] = m[ k ].replace( /\[.*$/, "" ); // remove the plugin arguments at the end of the path
								m[ k ] = m[ k ].replace( /^\.\//, "" ); // remove the relative path "./"
							});
						}
					});
					buildForm( dependencyMap );
				}
			);
		};

	refreshForm();

	$( document )
		.delegate( '.inc', 'change', resolveDependencies )
		.delegate( '.inc', 'click', function( e ) {
			$( e.target ).closest( ".group" ).find( ".sel-all" ).prop( "checked", false )
		})
		.delegate( '.sel-all', 'change', selectAll )
	
	$( '#branch' ).change( refreshForm );

	$( "#builder" ).bind( 'submit',
		function( e ) {
			var $el = $( this ),
				formData = $el.find( ':checked' ),
				branch = $( "#branch option:selected" ).val() || "master",
				config;

			e.preventDefault();
			e.stopImmediatePropagation();

			config = {
				baseUrl: "js",
				include: formData.map( function() { return $( this ).attr( 'id' ).replace( /\-/g, '.' ); } ).toArray().join( "," ),
				// The excludes need to be kept in sync with the ones in jQM's Makefile
				exclude: [ "jquery,../external/requirejs/order", "../external/requirejs/depend", "../external/requirejs/text", "../external/requirejs/text!../version.txt" ].join( "," ),
				pragmasOnSave: '{ "jqmBuildExclude": true }',
				preserveLicenseComments: false,
				filter: "../build/filter"
			};

			location.href = host + '/v1/bundle/jquery/jquery-mobile/' + branch + '/jquery.mobile.custom.zip?' + $.param( config );
		});
});
