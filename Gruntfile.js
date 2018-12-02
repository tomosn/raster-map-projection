
module.exports = function (grunt) {

  grunt.initConfig({

    pkg: grunt.file.readJSON('package.json'),

    jshint: {
      files: [
        'src/rasterproj-common.js',
        'src/rasterproj-aeqd.js',
        'src/rasterproj-laea.js',
        'src/rasterproj-tmerc.js',
        'src/proj-map.js',
        'src/graticule-renderer.js',
      ],
      options: {
        jshintrc: '.jshintrc'
      }
    },

    uglify: { // task
      dist: { // target
        options: {
          mangle: true,
          compress: {
            drop_console: true
          },
          banner: [
            '/*!',
            ' * <%= pkg.name %> <%= pkg.version %>  <%= grunt.template.today("yyyy-mm-dd") %>',
            ' *   https://github.com/tomosn/raster-map-projection',
            ' *   <%= pkg.description %>',
            ' * Copyright (C) 2016-2018 <%= pkg.author %>',
            ' * All rights reserved. ',
            ' * @license GPL v3 License (http://www.gnu.org/licenses/gpl.html)',
            ' */',
            ''
          ].join('\n')
        },

        files: {
          'dist/rasterproj-common.min.js': 'src/rasterproj-common.js',
          'dist/rasterproj-aeqd.min.js': 'src/rasterproj-aeqd.js',
          'dist/rasterproj-laea.min.js': 'src/rasterproj-laea.js',
          'dist/rasterproj-tmerc.min.js': 'src/rasterproj-tmerc.js',
          'dist/proj-map.min.js': 'src/proj-map.js',
          'dist/graticule-renderer.min.js': 'src/graticule-renderer.js',
        }
      }
    }
  });

  //  Grunt plugins
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  //  default task
  grunt.registerTask('default', ['jshint', 'uglify']);

};
