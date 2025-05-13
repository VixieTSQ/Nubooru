@group(0) @binding(0) var<storage, read_write> inputBuffer0: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> inputBuffer1: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> inputBuffer2: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> inputBuffer3: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> inputBuffer4: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> inputBuffer5: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> inputBuffer6: array<vec4f>;
@group(0) @binding(7) var <uniform> kernels: array<mat4x4f, 14>;
@group(0) @binding(8) var <uniform> bias: vec4f;
@group(0) @binding(9) var <storage, read_write> outputBuffer: array<vec4f>;
@group(0) @binding(10) var <uniform> _inputWidth: vec2u;

@compute @workgroup_size(8, 8) fn main( @builtin(global_invocation_id) id: vec3<u32>) {
    let inputWidth = _inputWidth[0];

    let x = id.x;
    let y = id.y;
    
    let i = id.y*inputWidth + x;
    var result  = vec4f(0.0, 0.0, 0.0, 0.0);
    
    let coord = vec2<i32>( i32(x), i32(y));
    
    let buff_ind = coord.y*i32(inputWidth) + coord.x;

    let pixel_val0 = inputBuffer0[buff_ind];
    result += kernels[0]*max(pixel_val0, vec4f(0.0));
    result += kernels[1]*max(-1.0*pixel_val0, vec4f(0.0));

    let pixel_val1 = inputBuffer1[buff_ind];
    result += kernels[2]*max(pixel_val1, vec4f(0.0));
    result += kernels[3]*max(-1.0*pixel_val1, vec4f(0.0));

    let pixel_val2 = inputBuffer2[buff_ind];
    result += kernels[4]*max(pixel_val2, vec4f(0.0));
    result += kernels[5]*max(-1.0*pixel_val2, vec4f(0.0));

    let pixel_val3 = inputBuffer3[buff_ind];
    result += kernels[6]*max(pixel_val3, vec4f(0.0));
    result += kernels[7]*max(-1.0*pixel_val3, vec4f(0.0));

    let pixel_val4 = inputBuffer4[buff_ind];
    result += kernels[8]*max(pixel_val4, vec4f(0.0));
    result += kernels[9]*max(-1.0*pixel_val4, vec4f(0.0));

    let pixel_val5 = inputBuffer5[buff_ind];
    result += kernels[10]*max(pixel_val5, vec4f(0.0));
    result += kernels[11]*max(-1.0*pixel_val5, vec4f(0.0));

    let pixel_val6 = inputBuffer6[buff_ind];
    result += kernels[12]*max(pixel_val6, vec4f(0.0));
    result += kernels[13]*max(-1.0*pixel_val6, vec4f(0.0));
            
    result += bias;
    
    outputBuffer[buff_ind] = result;
}