var gulp = require('gulp');
var sass = require('gulp-sass');
var ngAnnotate = require('gulp-ng-annotate');
var mainBowerFiles = require('main-bower-files');
var livereload = require('gulp-livereload');
var gulpFilter = require('gulp-filter');
var concat = require('gulp-concat');
var notify = require('gulp-notify');
var uglify = require('gulp-uglify');
var run = require('gulp-run');
var rename = require("gulp-rename");
var jade = require('gulp-jade');

gulp.task('watch', function() {
    livereload.listen();
    gulp.watch('./frontend/_sass/**/*.scss', ['sass']);
    gulp.watch('./frontend/app/**/*.js', ['minify-js']);
    gulp.watch('./frontend/app/**/*.jade', ['jade']);
});

gulp.task('reload', function() {
    livereload();
});

gulp.task('minify-js', function() {
    var angularjsapp = ['./frontend/app/main.js', './frontend/app/**/*.js']
    gulp.src(angularjsapp)
        .pipe(concat('main.min.js'))
        .pipe(gulp.dest('./frontend/_public/js/'))
        .pipe(notify({
           message: "Javascript files are now processed!"
        }))
        .pipe(livereload());
});

gulp.task('jade', function() {
    gulp.src(['./frontend/app/**/*.jade'])
        .pipe(jade({
            pretty: true
        }))
        .on('error', function(err) {
            console.log(err.message);
        })
        .pipe(gulp.dest('./frontend/html/'))
        .pipe(notify({
            message: "Jade files are now processed!"
        }));
});

gulp.task('sass', function() {
    var sasscCommand;

    if (process.platform == 'linux') {
        sasscCommand = './bin/sassc-ubuntu -s';
    } else if (process.platform == 'darwin') {
        sasscCommand = './bin/sassc -s';
    }

    return gulp.src('./frontend/_sass/*.scss')
        .pipe(run(sasscCommand, {
            verbosity: 1
        }))
        .on('error', function(err) {
            console.log(err);
        })
        .pipe(rename(function(path) {
            path.extname = ".css";
        }))
        .pipe(gulp.dest('./frontend/_public/stylesheets/'))
        .pipe(livereload())
        .pipe(notify({
            message: "Analytics CSS files are processed!"
        }));
});

gulp.task('bowerjs', function() {
    var jsfilter = gulpFilter('*.js');
    gulp.src(mainBowerFiles())
        .pipe(jsfilter)
        .pipe(ngAnnotate())
        .pipe(uglify())
        .pipe(concat('vendor.min.js'))
        .pipe(gulp.dest('./frontend/_public/js/vendor/'))
        .pipe(notify({
            message: "Bower Component JS files are now processed!"
        }));
});

gulp.task('bowercss', function() {
    var cssfilter = gulpFilter('*.css');
    gulp.src(mainBowerFiles())
        .pipe(cssfilter)
        .pipe(concat('vendor.min.css'))
        .pipe(gulp.dest('./frontend/_public/stylesheets/'))
        .pipe(notify({
            message: "Bower Component JS files are now processed!"
        }));
})

gulp.task('default', ['watch', 'sass', 'bowerjs', 'bowercss', 'minify-js', 'jade']);