@group(0) @binding(0) var<storage, read_write> inputBuffer0: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> inputBuffer1: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> inputBuffer2: array<vec4f>;
@group(0) @binding(3) var inputTexture: texture_2d<f32>;
@group(0) @binding(4) var ourSampler: sampler;
@group(0) @binding(5) var <uniform> inputResolution: vec2u;

struct VertexShaderOutput {
    @builtin(position) position: vec4f,
    @location(0) tex_coord: vec2f,
};

@vertex
fn vertexMain( @builtin(vertex_index) vertexIndex : u32) ->  VertexShaderOutput{
    let pos = array(
        // 1st triangle
        vec2f( -1.0,  -1.0),  // center
        vec2f( 1.0,  -1.0),  // right, center
        vec2f( -1.0,  1.0),  // center, top
        
        // 2st triangle
        vec2f( -1.0,  1.0),  // center, top
        vec2f( 1.0,  -1.0),  // right, center
        vec2f( 1.0,  1.0),  // right, top
    );
    
    var vsOutput: VertexShaderOutput;
    let xy = pos[vertexIndex];
    vsOutput.position = vec4f(xy, 0.0, 1.0);
    vsOutput.tex_coord = xy*0.5 + 0.5;
    vsOutput.tex_coord.y = - 1.0* vsOutput.tex_coord.y  + 1.0;
    vsOutput.tex_coord.x =  vsOutput.tex_coord.x*1;
    vsOutput.tex_coord.y =  vsOutput.tex_coord.y*1;
    return vsOutput;
}

@fragment fn fragmentMain(input: VertexShaderOutput) -> @location(0) vec4f {
    let inputWidth = inputResolution[0];
    let inputHeight = inputResolution[1];


    let x = f32(inputWidth)*(input.tex_coord.x);
    let y = f32(inputHeight)*(input.tex_coord.y);
    
    let y2 = u32(floor(y));
    let x2 = u32(floor(x));
    
    let i = y2*inputWidth + x2;
    
    let x_floor  = u32(fract(x)*2.0);
    let y_floor  = u32(fract(y)*2.0);
    
    // I don t know, I think this is right? I found this by trial and error
    let c_index: u32 = x_floor + y_floor*2;  

    let value = inputBuffer0[i][c_index];
    let value1 = inputBuffer1[i][c_index];
    let value2 = inputBuffer2[i][c_index];
    
    let bicubic = textureSample(inputTexture, ourSampler, input.tex_coord);
    
    return bicubic + vec4f(value, value1, value2, value2);
}