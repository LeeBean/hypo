/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

'use strict';

const path = require('path');
const gulp = require('gulp');
const gulpif = require('gulp-if');
var nodeSass = require('node-sass');
var fs = require('fs');
var map = require('map-stream');
var basePath = "src/";
var excludeDir = "bower_components/";
var ext = "**/*.html";

// Got problems? Try logging 'em
// const logging = require('plylog');
// logging.setVerbose();

// !!! IMPORTANT !!! //
// Keep the global.config above any of the gulp-tasks that depend on it
global.config = {
    polymerJsonPath: path.join(process.cwd(), 'polymer.json'),
    build: {
        rootDirectory: 'build',
        bundledDirectory: 'bundled',
        unbundledDirectory: 'unbundled',
        // Accepts either 'bundled', 'unbundled', or 'both'
        // A bundled version will be vulcanized and sharded. An unbundled version
        // will not have its files combined (this is for projects using HTTP/2
        // server push). Using the 'both' option will create two output projects,
        // one for bundled and one for unbundled
        bundleType: 'both'
    },
    // Path to your service worker, relative to the build root directory
    serviceWorkerPath: 'service-worker.js',
    // Service Worker precache options based on
    // https://github.com/GoogleChrome/sw-precache#options-parameter
    swPrecacheConfig: {
        navigateFallback: '/index.html'
    }
};

// Add your own custom gulp tasks to the gulp-tasks directory
// A few sample tasks are provided for you
// A task should return either a WriteableStream or a Promise
const clean = require('./gulp-tasks/clean.js');
const images = require('./gulp-tasks/images.js');
const project = require('./gulp-tasks/project.js');

// The source task will split all of your source files into one
// big ReadableStream. Source files are those in src/** as well as anything
// added to the sourceGlobs property of polymer.json.
// Because most HTML Imports contain inline CSS and JS, those inline resources
// will be split out into temporary files. You can use gulpif to filter files
// out of the stream and run them through specific tasks. An example is provided
// which filters all images and runs them through imagemin
function source() {
    return project.splitSource()
        // Add your own build tasks here!
        .pipe(gulpif('**/*.{png,gif,jpg,svg}', images.minify()))
        .pipe(project.rejoin()); // Call rejoin when you're finished
}

// The dependencies task will split all of your bower_components files into one
// big ReadableStream
// You probably don't need to do anything to your dependencies but it's here in
// case you need it :)
function dependencies() {
    return project.splitDependencies()
        .pipe(project.rejoin());
}

// Clean the build directory, split all source and dependency files into streams
// and process them, and output bundled and unbundled versions of the project
// with their own service workers
gulp.task('default', gulp.series([
    clean([global.config.build.rootDirectory]),
    project.merge(source, dependencies),
    project.serviceWorker
]));



//================= sass ==================================

/**
 * We need to specify to nodeSass the include paths for Sass' @import
 * command. These are all the paths that it will look for it.
 *
 * Failing to specify this, will NOT Compile your scss and inject it to
 * your .html file.
 *
 */
var includePaths = ['src/**/'];

//gulp.task('watchSass', function(){
//    gulp.watch(['src/**/*.scss', '!bower_components/**/*.scss'], ["injectSass"]);
//});


gulp.task('watchSass', function() {
    gulp.watch(['src/**/*.scss', '!bower_components/**/*.scss'], gulp.series('injectSass'));

});





//This is currently not used. But you can enable by uncommenting 
// " //return gulp.src([basePath+ext,...excludeDirs])" above the return.
var excludeDirs = ['!${basePath}/bower_components/${ext}','!${basePath}/images/${ext}']
/**
 *
 * Enable for advanced use:
 *
 *
 */

gulp.task('injectSass', function () {
    /* Original creator: David Vega. I just modified
     * it to take advantage of the Polymer 1.1's shared styles.
     *
     * This will look all the files that are inside:
     * app/elements folder. You can change this to match
     * your structure.  Note, this gulp script uses convention
     * over configuration. This means that if you have a file called
     * my-element-styles.html you should have a file called
     * my-element-styles.scss
     *
     * Note #2:
     * We use "!" (Exclamation Mark) to exclude gulp from searching these paths.
     * What I'm doing here, is that Polymer Starter Kit has inside its app folder
     * all the bower dependencies (bower_components). If we don't specify it to
     * exclude this path, this will look inside bower_components and will take a long time
     * (around 7.4 seconds in my machine) to replace all the files.
     */
    //Uncomment if you want to specify multiple exclude directories. Uses ES6 spread operator.
    //return gulp.src([basePath+ext,...excludeDirs])
    return gulp.src([basePath+ext, '!'+excludeDir+ext])
        .pipe(map(function (file, cb) {
            //This will match anything between the Start Style and End Style HTML comments.
            var startStyle = "<!-- Start Style -->";
            var endStyle = "<!-- End Style -->";
            //Creates the regEx this ways so I can pass the variables.
            var regEx = new RegExp(startStyle+"[\\s\\S]*"+endStyle, "g");

            // Converts file buffer into a string
            var contents = file.contents.toString();


            //Checks if the RegEx exists in the file. If not,
            //don't do anything and return.

            //Rewrote the if for reduced nesting.
            if (!regEx.test(contents)) {
                //Return empty. if we return cb(null, file). It will add
                //the file that we do not want to the pipeline!!
                return cb();
            }
            /**
             * Getting scss
             * This will get the .html file that matches the current name
             * This means that if you have my-app.component.html
             * this will match my-app.component.scss. Replace with .sass if you
             * have .sass files instead.
             */
            var scssFile = file.path.replace(/\.html$/i, '.scss');

            fs.readFile(scssFile, function (err, data) {

                //Rewrote the if for reduced nesting.
                //If error or there is no Sass, return null.
                if (err || !data) {
                    return cb();
                }
                nodeSass.render({
                    data: data.toString(),
                    includePaths: [path.join('app', 'style/'),includePaths],
                    outputStyle: 'compressed'
                }, function (err, compiledScss) {


                    //Rewrote the if for reduced nesting.
                    //If error or there is no Sass, return null.
                    if (err || !compiledScss)
                        return cb();
                    /**
                     * What we are doing here is simple:
                     * We are re-creating the start and end placeholders
                     * that we had and inject them back to the .html file
                     *
                     * This will allow us to re-inject any changes that we
                     * do to our .scss or files.
                     *
                     */
                    var injectSassContent = startStyle +
                        "<style>" +
                        compiledScss.css.toString() +
                        "</style>" +
                        endStyle;

                    //This is going to replace everything that was between the <!-- Start Style --> and
                    // "<!-- End Style -->"
                    file.contents = new Buffer(contents.replace(regEx, injectSassContent), 'utf8');
                    //This return is necessary, or the modified map will not be modified!
                    return cb(null,file);
                });
            });
        }))
        .pipe(gulp.dest(basePath));
}); //Ends 