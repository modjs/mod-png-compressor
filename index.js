var fs = require('fs');
var path = require('path');
var execFile = require('child_process').execFile;

exports.summary = 'compress png images';

exports.usage = '<src> [options]';

exports.options = {
    dest : {
        alias : 'd'
        ,describe : 'destination file'
    },

    iebug: {
        default: true,
        describe : 'Workaround for IE6, which only displays fully opaque pixels. pngquant will make almost-opaque pixels fully opaque and will avoid creating new transparent colors.'
    }
};

exports.run = function (options, done) {

    var dest = options.dest;
    var file = exports.file;
    // 1. Basic optimisation
    // optipng xx.png -out xx2.png
    // optipng xx.png -dir ./img
    // default -o2
    // 
    // 2. Removing unnecessary chunks
    // pngcrush -q -rem gAMA -rem alla -rem text image.png image.crushed.png
    // 
    // 3. Reducing the colour palette  
    // pngnq -f -n 32 -s 3 image.png  http://sourceforge.net/projects/pngnqs9/
    //  or 
    // pngquant 256 *.png  https://github.com/pornel/pngquant
    
    exports.async.forEach(exports.files, function(inputFile, cb){
        var outputFile;
        if( !dest ) {
            outputFile = inputFile; 
        }else if( file.isDirFormat(dest) ){
            var filename = path.basename(inputFile);
            outputFile = path.join(dest, filename);
        }else{
            outputFile = dest;
        }
        exports.pngcompressor(inputFile, outputFile, options, cb);

    }, done);

};

exports.pngcompressor = function(inputFile, outputFile, options, done){
    var originalSize = fs.statSync(inputFile).size;
    exports.async.series([
        exports.optipng.bind(null, inputFile, outputFile, options),
        exports.pngcrush.bind(null, outputFile, outputFile, options),
        exports.pngquant.bind(null, outputFile, outputFile, options)
    ], function(err){
        saved = originalSize - fs.statSync(outputFile).size;
        // TODO: check or create target build dir
        if ( saved < 10 ) {
            exports.log(inputFile.grey, "(already optimized)", ">".grey, outputFile.grey);
        }else{
            exports.log(inputFile.grey, "(saved "+ saved+ "Bytes)", ">".grey, outputFile.grey);
        }
        done(err);
    });

};

exports.optipng = function(inputFile, outputFile, options, done) {
    var binPath = require('optipng-bin').path;
    var file = exports.file;
    var args = [];
    // OptiPNG can't overwrite without creating a backup file
    // https://sourceforge.net/tracker/?func=detail&aid=3607244&group_id=151404&atid=780913
    if (path.resolve(outputFile) !== path.resolve(inputFile) && file.exists(outputFile)) {
        file.delete(outputFile);
    }

    args.push('-strip', 'all', inputFile, "-out", outputFile, '-o', options.level||2 );
    execFile(binPath, args, function(err, stdout, stderr) {

        if (options.verbose) {
            stdout && console.log(stdout);
            stderr && console.log(stderr);
        }
        done();
    });


};

exports.pngcrush = function(inputFile, outputFile, options, done){
    var pngcrush = require('node-pngcrush');
    var data = fs.readFileSync(inputFile);

    var buffer = pngcrush.compress(data);

    fs.writeFileSync(outputFile, buffer, {
        flags: 'wb'
    });

    done();
};


exports.pngquant = function(inputFile, outputFile, options, done){
    var pngquant = require('node-pngquant-native');
    var data = fs.readFileSync(inputFile);

    var buffer = pngquant.option({
        params: '-v' + options.iebug? ' --iebug' : ''
    }).compress(data);

    fs.writeFileSync(outputFile, buffer, {
        flags: 'wb'
    });

    done();
};


