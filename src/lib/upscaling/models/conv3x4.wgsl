@group(0) @binding(0) var inputTexture0: texture_2d<f32>;
@group(0) @binding(1) var <uniform> kernel_offsets: array<vec4f, 9>;
@group(0) @binding(2) var <uniform> kernels: array<mat4x4f, 9>;
@group(0) @binding(3) var <uniform> bias: vec4f;
@group(0) @binding(4) var <storage, read_write> outputBuffer: array<vec4f>;
@group(0) @binding(5) var <uniform> _inputWidth: vec2u;

@compute @workgroup_size(8, 8) fn main( @builtin(global_invocation_id) id: vec3<u32>) {
    let inputWidth = _inputWidth[0];
    
    let x = id.x;
    let y = id.y;
    
    let i = id.y*inputWidth + x;
    var result  = vec4f(0.0, 0.0, 0.0, 0.0);
    
    let coord = vec2<i32>( i32(x), i32(y));
            
    for(var i = 0u; i < 9; i++){
        let offset = vec2<i32>(kernel_offsets[i].xy);
        result += kernels[i]*textureLoad(inputTexture0, coord + offset, 0);
    } 
        
    result += bias;
    
    outputBuffer[i] = result;
}