/** 
 * This file is for parsing an OBJ file into a mesh of vertices, faces, and texture coords. and calculating
 * the averaged face normals.
 *
 * @author      
 */

/**
 * Gets a file from the server for processing on the client side.
 * @param {String} filename A string that is the name of the file to get
 * @return {Array} String of all text stored in the file. 
 */
function readTextFile(filename)
{
    console.log("reading "+ filename);
    var rawFile = new XMLHttpRequest();
    var allText = [];
    rawFile.open("GET", filename, false); //don't want synchronization issues b/c don't have time to learn JS parallelization primitives atm
    rawFile.onreadystatechange = function ()
    {
        if(rawFile.readyState === 4) //triple equals? :o
        {
            if(rawFile.status === 200 || rawFile.status == 0)
            {
                 allText = rawFile.responseText;
                 console.log("Got text file!");
            }
        }
    }
    rawFile.send(null);
    return allText;
}

/**
 * Find and return a list of all .obj filenames in the app directory.
 * @return {Array} Array of strings containing the filenames of all .obj files in the app directory.
 */
function getOBJfiles() {
    var textResult = readTextFile(".");
    var meshList = [];
    if(textResult.length < 1) {
        return meshList;
    }
    
    var inputtingMesh = false;
    var curMesh = "";
    for(var i = 1; i < textResult.length; i++) {
        if(inputtingMesh) {
            if(textResult[i] == "\"") { //end of filename
                inputtingMesh = false;
                if(IsOBJFile(curMesh)) { //add to mesh list if .obj file
                    meshList.push(curMesh); 
                }
            } else {
                curMesh += textResult[i];
            }
        } else if(textResult[i-1] == "<" && textResult[i] == "a") { //marker indicating .obj filename
            inputtingMesh = true;
            curMesh = "";
            i += 7;
        }
    }
    console.log("Found OBJ files: " + meshList);
    return meshList;
}

function IsOBJFile(filename) {
    var len = filename.length;
    if(len < 4) {
        return false;
    }
    return (filename.substring(len-4, len) == ".obj");
}

/**
 * Parse an OBJ file consisting of only vertices, faces, vertex texture coordinates, and comments
 * @param {String} filename String name of the file in the current server directory to parse
 * @param {Array} meshVertices 0-length Array that will hold the vertices
 * @param {Array} meshIndices 0-length Array that will hold the indices of the vertices that make up the faces of the mesh
 * @param {Array} textureCoords 0-length Array that will hold the 2D texture coordinates, if specified in the file
 * @return {bool} True if texture coordinates were specified; False if not
 */
function parseOBJ(filename, meshVertices, meshIndices, textureCoords) {
    var text = readTextFile(filename);
    var len = text.length;
    var spaces = 0; //#spaces in current line
    var curNum = []; //current float or int (represented as a string) that we're parsing
    var lineType = 3; //0: vertex line "v ..."; 1: face line "f  ..."; 2: vertex texture coords. line "vt [u] [v]"
    var commentLine = false; //true if current line is a comment
    var lineElementsLeft = 0; //expect vertex line to have 4 elements (optional 3), face line 3, and vtx. texture line 2
    var lineNum = 1; //for debugging mostly
    var hasTexture = false;
    console.log("text len = " + len.toString());

    for(var i = 0; i < len; i++){
        //Vertex line with 4 spaces: didn't include 4th alpha argument; use default 1.0
        //Last char is newline "\n" too; good
        switch(text[i]) {
            case "\n": //newline
                if(lineElementsLeft > 0 && !commentLine) {
                    if(curNum.length > 0) { //still have a number we were working on
                        switch(lineType) {
                            case 0:
                                meshVertices.push(parseFloat(curNum.join("")));
                                break;
                            case 1:
                                meshIndices.push(parseInt(curNum.join(""), 10) - 1); //in OBJ, indices start at 1 but we need start at 0
                                break;
                            case 2:
                                textureCoords.push(parseFloat(curNum.join("")));
                                break;
                        }
                        lineElementsLeft--;
                        curNum = [];
                    }
                    if(lineElementsLeft > 0) { //check again
                        if(lineType != 0) {
                            var msg = "Face";
                            if(lineNum == 2) msg = "Vertex Texture Coordinates";
                            console.log("ERROR: " + filename + ", line " + lineNum.toString() + ": " + msg + " line with too few elements!");
                            throw new Error("Face line with too few elements!", filename, lineNum);
                        }
                        else {
                            if(lineElementsLeft == 1)
                                meshVertices.push(1.0); //default w-comp. to 1.0
                            else {
                                console.log("ERROR: " + filename + ", line " + lineNum.toString() + ": Vertex line with too few elements!");
                                throw new Error("Vertex line with too few elements!", filename, lineNum);
                            }
                        }
                    }
                }
                spaces = 0;
                curNum = [];
                lineNum++;
                lineType = 3; //indicates not set yet
                commentLine = false;
                break;
            case "#": //comment; disregard entire line
                commentLine = true;
                break;
            case "g": //group name specifier (we'll just ignore)
                if(lineType != 3) {
                    console.log("ERROR: " + filename + ", line " + lineNum.toString() + ": Unrecognized line format!");
                    throw new Error("Unrecognized line format!", filename, lineNum);
                } else commentLine = true;
                break;
            case "v":
                if(!commentLine) {
                    lineType = 0; //vertex line
                    lineElementsLeft = 4;
                }
                break;
            case "f":
                if(!commentLine) {
                    lineType = 1; //face line
                    lineElementsLeft = 3;
                }
                break;
            case "t":
                if(!commentLine) {
                    if(lineType == 0) { 
                        lineType = 2; //vt -> 2D vertex texture coordinates line
                        lineElementsLeft = 2;
                        hasTexture = true;
                    } else {
                        console.log("ERROR: " + filename + ", line " + lineNum.toString() + ": Unrecognized line format!");
                        throw new Error("Unrecognized line format!", filename, lineNum);
                    }
                }
                break;
            case " ": 
                if(!commentLine) {
                    if(spaces > 0) {
                        //.join("") combines all elements of an array into a string separated by "" (nothing)
                        switch(lineType) {
                            case 0: //vertex line: parsing a float
                                meshVertices.push(parseFloat(curNum.join("")));
                                break;
                            case 1: //face line: parsing an int
                                meshIndices.push(parseInt(curNum.join(""), 10) - 1); //in OBJ, indices start at 1 but we need start at 0
                                break;
                            case 2: //vertex texture coords. line: parsing a float
                                textureCoords.push(parseFloat(curNum.join("")));
                                break;
                        }
                        lineElementsLeft--;
                        curNum = [];
                    }
                    if(text[i+1] != " ") spaces++; //if we have a sequence of spaces, only count the last one
                }
                break;
            default:
                if(!commentLine) curNum.push(text[i]);
        }
    }
    console.log("parseOBJ: DONE: Parsed " + lineNum.toString() + " lines");
    return hasTexture;
}

/**
 * Given the mesh vertices and indices, calculate the vertex normals via averaged face normals
 * @param {Array} meshVertices Array of coordinates of vertices, which must be a 4-vector. (although we just set w comp. to 1.0)
 * @param {Array} meshIndices Array of face indices.
 * @param {Float32Array} vertexNormals array of length (meshVertices.length)/4*3 which will hold the vertex normals
 */
function findVertexNormals(meshVertices, meshIndices, vertexNormals) {
    var numVertices = meshVertices.length / 4;
    var numTriangles = meshIndices.length / 3;
    for(var v = 0; v < numVertices; v++) { //initialize vertexFaces and vertexNormals
        vertexNormals[3*v    ] = 0;
        vertexNormals[3*v + 1] = 0;
        vertexNormals[3*v + 2] = 0;
    }
    for(var i = 0; i < numTriangles; i++) {
        var v0 = [meshVertices[4*meshIndices[3*i    ]], meshVertices[4*meshIndices[3*i    ] + 1], meshVertices[4*meshIndices[3*i    ] + 2]];
        var v1 = [meshVertices[4*meshIndices[3*i + 1]], meshVertices[4*meshIndices[3*i + 1] + 1], meshVertices[4*meshIndices[3*i + 1] + 2]];
        var v2 = [meshVertices[4*meshIndices[3*i + 2]], meshVertices[4*meshIndices[3*i + 2] + 1], meshVertices[4*meshIndices[3*i + 2] + 2]];
        var curNormal = cross(difference(v2, v0), difference(v1, v0));
        curNormal = normalize(curNormal);
        //vertex normals:
        for(var c = 0; c < 3; c++) { //c for component; x, then y, then z
            vertexNormals[3*meshIndices[3*i    ] + c] += curNormal[c]; //v0
            vertexNormals[3*meshIndices[3*i + 1] + c] += curNormal[c]; //v1
            vertexNormals[3*meshIndices[3*i + 2] + c] += curNormal[c]; //v2
        }
    }
    for(var v = 0; v < numVertices; v++) { //Normalize vertexNormals
        var vNorm = normalize([vertexNormals[3*v], vertexNormals[3*v+1], vertexNormals[3*v+2]]);
        vertexNormals[3*v] = vNorm[0];
        vertexNormals[3*v + 1] = vNorm[1];
        vertexNormals[3*v + 2] = vNorm[2];
    }
}

/**
 * Find the difference of two 3-vectors; a - b.
 * @param {Array} a
 * @param {Array} b
 * @return {Array}
 */
function difference(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
    
/**
 * Divide a vector a by a scalar d; a / d.
 * @param {Array} a
 * @param {number} d Divisor
 * @return {Array}
 */
function quotient(a, d) {
    return [a[0] / d, a[1] / d, a[2] / d];
}

/**
 * Find the cross product of two 3-vectors.
 * @param {Array} a
 * @param {Array} b
 * @return {Array}
 */
function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/**
 * Find the norm, or magnitude of a vector a -> ||a||
 * @param {Array} a
 * @return {number}
 */
function norm(a) {
    var sum = 0.0;
    for(var i = 0; i < a.length; i++) {
        sum += a[i] * a[i];
    }
    return Math.sqrt(sum);
}

/**
 * Find the norm of a vector a and divide a by it; a -> a / ||a||
 * @param {Array} a
 * @return {Array}
 */
function normalize(a) {
   return quotient(a, norm(a)); 
}