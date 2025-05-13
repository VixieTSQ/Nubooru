import animeWeightsRaw from "./cnn-2x-m-an.json?raw"
import rlWeightsRaw from "./cnn-2x-m-rl.json?raw"

import conv3x4ShaderWGSL from "./conv3x4.wgsl?raw"
import conv8x4ShaderWGSL from "./conv8x4.wgsl?raw"
import conv56x4ShaderWGSL from "./conv56x4.wgsl?raw"
import display3CShaderWGSL from "./display3c.wgsl?raw"

type WeightsEntry = {
    weights: number[],
    bias: number[]
};

type Weights = {
    ['conv2d_tf']: WeightsEntry,
    ['conv2d_1_tf']: WeightsEntry,
    ['conv2d_2_tf']: WeightsEntry,
    ['conv2d_3_tf']: WeightsEntry,
    ['conv2d_4_tf']: WeightsEntry,
    ['conv2d_5_tf']: WeightsEntry,
    ['conv2d_6_tf']: WeightsEntry,
    ['conv2d_7_tf']: WeightsEntry,
    ['conv2d_7_tf1']: WeightsEntry,
    ['conv2d_7_tf2']: WeightsEntry
}

const rlWeights: Weights = JSON.parse(rlWeightsRaw).layers;
const animeWeights: Weights = JSON.parse(animeWeightsRaw).layers;

const textureUsage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT;
export const renderUpscaled = async (gpu: GPUDevice, source: ImageBitmap, contentType: "rl" | "anime") => {
    const weights = contentType === "anime" ? animeWeights : rlWeights;

    const size = [source.width, source.height];
    const inputTexture = gpu.createTexture({
        label: "input",
        format: "rgba8unorm",
        size,
        usage: textureUsage
    });
    gpu.queue.copyExternalImageToTexture(
        { source },
        { texture: inputTexture },
        size
    );

    const outputBitmap = await runLayers(gpu, weights, inputTexture);

    inputTexture.destroy();

    return outputBitmap;
}

const bufferUsage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
const numberOfWorkgroups = 8;

const kernelOffsetsRaw = new Float32Array([
    -1, -1, 0, 0,
    -1, 0, 0, 0,
    -1, 1, 0, 0,
    0, -1, 0, 0,
    0, 0, 0, 0,
    0, 1, 0, 0,
    1, -1, 0, 0,
    1, 0, 0, 0,
    1, 1, 0, 0,
]);
let kernelOffsets: GPUBuffer | undefined = undefined;

type Resolution = {
    width: number,
    height: number
}

const runLayers = async (gpu: GPUDevice, weights: Weights, input: GPUTexture) => {
    const outputCanvas = new OffscreenCanvas(input.width * 2, input.height * 2);
    const renderingContext = outputCanvas.getContext("webgpu");
    if (renderingContext === null) {
        throw "Rendering context is null. What happened to our webgpu support???";
    }
    renderingContext.configure({
        device: gpu,
        format: navigator.gpu.getPreferredCanvasFormat()
    })

    if (kernelOffsets === undefined) {
        kernelOffsets = createUniform(gpu, `network-Anime4K-kernel_offsets`, kernelOffsetsRaw);
    }
    const resolution = {
        width: input.width,
        height: input.height
    };

    const conv3x4OutputBuffer = await runConv3x4(gpu, weights['conv2d_tf'], input);
    const conv8x4ZeroOutputBuffer = await runConv8x4(gpu, weights['conv2d_1_tf'], conv3x4OutputBuffer, resolution, 'conv2d_1_tf');
    const conv8x4OneOutputBuffer = await runConv8x4(gpu, weights['conv2d_2_tf'], conv8x4ZeroOutputBuffer, resolution, 'conv2d_2_tf');
    const conv8x4TwoOutputBuffer = await runConv8x4(gpu, weights['conv2d_3_tf'], conv8x4OneOutputBuffer, resolution, "conv2d_3_tf");
    const conv8x4ThreeOutputBuffer = await runConv8x4(gpu, weights['conv2d_4_tf'], conv8x4TwoOutputBuffer, resolution, 'conv2d_4_tf');
    const conv8x4FourOutputBuffer = await runConv8x4(gpu, weights['conv2d_5_tf'], conv8x4ThreeOutputBuffer, resolution, 'conv2d_5_tf');
    const conv8x4FiveOutputBuffer = await runConv8x4(gpu, weights['conv2d_6_tf'], conv8x4FourOutputBuffer, resolution, 'conv2d_6_tf');

    const conv56x4Inputs = {
        zero: conv3x4OutputBuffer,
        one: conv8x4ZeroOutputBuffer,
        two: conv8x4OneOutputBuffer,
        three: conv8x4TwoOutputBuffer,
        four: conv8x4ThreeOutputBuffer,
        five: conv8x4FourOutputBuffer,
        six: conv8x4FiveOutputBuffer,
    }
    const conv56x4ZeroOutputBuffer = await runConv56x4(gpu, weights['conv2d_7_tf'], conv56x4Inputs, resolution, 'conv2d_7_tf');
    const conv56x4OneOutputBuffer = await runConv56x4(gpu, weights['conv2d_7_tf1'], conv56x4Inputs, resolution, 'conv2d_7_tf1');
    const conv56x4TwoOutputBuffer = await runConv56x4(gpu, weights['conv2d_7_tf2'], conv56x4Inputs, resolution, 'conv2d_7_tf2');

    let display3CInputs = {
        zero: conv56x4ZeroOutputBuffer,
        one: conv56x4OneOutputBuffer,
        two: conv56x4TwoOutputBuffer,
        three: input
    }
    await runDisplay3C(gpu, display3CInputs, renderingContext.getCurrentTexture(), resolution);

    await gpu.queue.onSubmittedWorkDone();
    const outputBitmap = outputCanvas.transferToImageBitmap();

    conv3x4OutputBuffer.destroy();
    conv8x4ZeroOutputBuffer.destroy();
    conv8x4OneOutputBuffer.destroy();
    conv8x4TwoOutputBuffer.destroy();
    conv8x4ThreeOutputBuffer.destroy();
    conv8x4FourOutputBuffer.destroy();
    conv8x4FiveOutputBuffer.destroy();
    conv56x4ZeroOutputBuffer.destroy();
    conv56x4OneOutputBuffer.destroy();
    conv56x4TwoOutputBuffer.destroy();

    renderingContext.unconfigure();

    return outputBitmap;
}

let conv3x4InputWidth: GPUBuffer | undefined = undefined;
let conv3x4Pipeline: GPUComputePipeline | undefined = undefined;
const runConv3x4 = async (gpu: GPUDevice, weights: WeightsEntry, input: GPUTexture) => {
    if (conv3x4Pipeline === undefined || conv3x4InputWidth === undefined) {
        const conv3x4Shader = gpu.createShaderModule({
            label: `Anime4KConv3x4-shader`,
            code: conv3x4ShaderWGSL
        });
        conv3x4Pipeline = await gpu.createComputePipelineAsync({
            label: `Anime4KConv3x4-pipeline`,
            layout: 'auto',
            compute: {
                module: conv3x4Shader,
                entryPoint: 'main',
            }
        });

        conv3x4InputWidth = createUniform(gpu, `layer-Anime4KConv3x4-shader-buffer-input_width`, new Uint32Array([0, 0]));
    }

    gpu.queue.writeBuffer(conv3x4InputWidth, 0, new Uint32Array([input.width, input.height]));

    const outputBuffer = gpu.createBuffer({
        label: 'conv2d_tf',
        usage: bufferUsage,
        size: input.width * input.height * 4 * 4
    });

    const { kernels, bias } = getOrCreateWeightBuffer(gpu, weights, `layer-Anime4KConv3x4-shader-buffer-kernels`, `layer-Anime4KConv3x4-shader-buffer-bias`);

    const bindGroup = gpu.createBindGroup({
        layout: conv3x4Pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: input.createView() },
            { binding: 1, resource: { buffer: kernelOffsets! } },
            { binding: 2, resource: { buffer: kernels } },
            { binding: 3, resource: { buffer: bias } },
            { binding: 4, resource: { buffer: outputBuffer } },
            { binding: 5, resource: { buffer: conv3x4InputWidth } },
        ]
    });

    const encoder = gpu.createCommandEncoder({ label: 'Anime4KConv3x4-shader' });
    const pass = encoder.beginComputePass({ label: 'Anime4KConv3x4-shader' });

    pass.setPipeline(conv3x4Pipeline);
    pass.setBindGroup(0, bindGroup);

    pass.dispatchWorkgroups(
        Math.floor(input.width / numberOfWorkgroups),
        Math.floor(input.height / numberOfWorkgroups)
    );

    pass.end();
    gpu.queue.submit([encoder.finish()]);

    return outputBuffer;
}

let conv8x4InputWidth: GPUBuffer | undefined = undefined;
let conv8x4Pipeline: GPUComputePipeline | undefined = undefined;
const runConv8x4 = async (gpu: GPUDevice, weights: WeightsEntry, input: GPUBuffer, inputResolution: Resolution, outputLabel: string) => {
    if (conv8x4Pipeline === undefined || conv8x4InputWidth === undefined) {
        const conv8x4Shader = gpu.createShaderModule({
            label: `Anime4KConv8x4-shader`,
            code: conv8x4ShaderWGSL
        });
        conv8x4Pipeline = await gpu.createComputePipelineAsync({
            label: `Anime4KConv8x4-pipeline`,
            layout: 'auto',
            compute: {
                module: conv8x4Shader,
                entryPoint: 'main',
            }
        });

        conv8x4InputWidth = createUniform(gpu, `layer-Anime4KConv8x4-shader-buffer-input_width`, new Uint32Array([0, 0]));
    }

    gpu.queue.writeBuffer(conv8x4InputWidth, 0, new Uint32Array([inputResolution.width, inputResolution.height]));

    const outputBuffer = gpu.createBuffer({
        label: outputLabel,
        usage: bufferUsage,
        size: inputResolution.width * inputResolution.height * 4 * 4
    });

    const { kernels, bias } = getOrCreateWeightBuffer(gpu, weights, `layer-Anime4KConv8x4-shader-buffer-kernels`, `layer-Anime4KConv8x4-shader-buffer-bias`);

    const bindGroup = gpu.createBindGroup({
        layout: conv8x4Pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: input } },
            { binding: 1, resource: { buffer: kernelOffsets! } },
            { binding: 2, resource: { buffer: kernels } },
            { binding: 3, resource: { buffer: bias } },
            { binding: 4, resource: { buffer: outputBuffer } },
            { binding: 5, resource: { buffer: conv8x4InputWidth } },
        ]
    });

    const encoder = gpu.createCommandEncoder({ label: 'Anime4KConv8x4-shader' });
    const pass = encoder.beginComputePass({ label: 'Anime4KConv8x4-shader' });

    pass.setPipeline(conv8x4Pipeline);
    pass.setBindGroup(0, bindGroup);

    pass.dispatchWorkgroups(
        Math.floor(inputResolution.width / numberOfWorkgroups),
        Math.floor(inputResolution.height / numberOfWorkgroups)
    );

    pass.end();
    gpu.queue.submit([encoder.finish()]);

    return outputBuffer;
}

type Conv56x4Inputs = {
    zero: GPUBuffer,
    one: GPUBuffer,
    two: GPUBuffer,
    three: GPUBuffer,
    four: GPUBuffer,
    five: GPUBuffer,
    six: GPUBuffer,
}
let conv56x4InputWidth: GPUBuffer | undefined = undefined;
let conv56x4Pipeline: GPUComputePipeline | undefined = undefined;
const runConv56x4 = async (gpu: GPUDevice, weights: WeightsEntry, inputs: Conv56x4Inputs, inputResolution: Resolution, outputLabel: string) => {
    if (conv56x4Pipeline === undefined || conv56x4InputWidth === undefined) {
        const conv56x4Shader = gpu.createShaderModule({
            label: `Anime4KConv56x4-shader`,
            code: conv56x4ShaderWGSL
        });
        conv56x4Pipeline = await gpu.createComputePipelineAsync({
            label: `Anime4KConv56x4-pipeline`,
            layout: 'auto',
            compute: {
                module: conv56x4Shader,
                entryPoint: 'main',
            }
        });

        conv56x4InputWidth = createUniform(gpu, `layer-Anime4KConv58x4-shader-buffer-input_width`, new Uint32Array([0, 0]));
    }

    gpu.queue.writeBuffer(conv56x4InputWidth, 0, new Uint32Array([inputResolution.width, inputResolution.height]));

    const outputBuffer = gpu.createBuffer({
        label: outputLabel,
        usage: bufferUsage,
        size: inputResolution.width * inputResolution.height * 4 * 4
    });

    const { kernels, bias } = getOrCreateWeightBuffer(gpu, weights, `layer-Anime4KConv56x4-shader-buffer-kernels`, `layer-Anime4KConv56x4-shader-buffer-bias`);

    const bindGroup = gpu.createBindGroup({
        layout: conv56x4Pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: inputs.zero } },
            { binding: 1, resource: { buffer: inputs.one } },
            { binding: 2, resource: { buffer: inputs.two } },
            { binding: 3, resource: { buffer: inputs.three } },
            { binding: 4, resource: { buffer: inputs.four } },
            { binding: 5, resource: { buffer: inputs.five } },
            { binding: 6, resource: { buffer: inputs.six } },
            { binding: 7, resource: { buffer: kernels } },
            { binding: 8, resource: { buffer: bias } },
            { binding: 9, resource: { buffer: outputBuffer } },
            { binding: 10, resource: { buffer: conv56x4InputWidth } },
        ]
    });

    const encoder = gpu.createCommandEncoder({ label: 'Anime4KConv56x4-shader' });
    const pass = encoder.beginComputePass({ label: 'Anime4KConv56x4-shader' });

    pass.setPipeline(conv56x4Pipeline);
    pass.setBindGroup(0, bindGroup);

    pass.dispatchWorkgroups(
        Math.floor(inputResolution.width / numberOfWorkgroups),
        Math.floor(inputResolution.height / numberOfWorkgroups)
    );

    pass.end();
    gpu.queue.submit([encoder.finish()]);

    return outputBuffer;
}

type Display3CInputs = {
    zero: GPUBuffer,
    one: GPUBuffer,
    two: GPUBuffer,
    three: GPUTexture
}
let display3CSampler: GPUSampler | undefined = undefined;
let display3CInputResolution: GPUBuffer | undefined = undefined;
let display3CPipeline: GPURenderPipeline | undefined = undefined;
const runDisplay3C = async (gpu: GPUDevice, inputs: Display3CInputs, output: GPUTexture, inputResolution: Resolution) => {
    if (display3CPipeline === undefined || display3CInputResolution === undefined || display3CSampler === undefined) {
        const display3CShader = gpu.createShaderModule({
            label: `Anime4KDisplay3C-shader`,
            code: display3CShaderWGSL
        });
        display3CPipeline = await gpu.createRenderPipelineAsync(
            {
                label: `Display3C-pipeline`,
                layout: 'auto',
                vertex: {
                    module: display3CShader,
                    entryPoint: 'vertexMain',
                },
                fragment: {
                    module: display3CShader,
                    entryPoint: 'fragmentMain',
                    targets: [{ format: output.format }],
                },
            });

        display3CInputResolution = createUniform(gpu, `layer-Anime4KDisplay3C-shader-buffer-input_resolution`, new Uint32Array([0, 0]));
        display3CSampler = gpu.createSampler({
            addressModeU: "repeat",
            addressModeV: "repeat",
            magFilter: "linear",
            minFilter: "linear",
            mipmapFilter: "linear",
        });
    }

    gpu.queue.writeBuffer(display3CInputResolution, 0, new Uint32Array([inputResolution.width, inputResolution.height]));

    const bindGroup = gpu.createBindGroup({
        layout: display3CPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: inputs.zero } },
            { binding: 1, resource: { buffer: inputs.one } },
            { binding: 2, resource: { buffer: inputs.two } },
            { binding: 3, resource: inputs.three.createView() },
            { binding: 4, resource: display3CSampler },
            { binding: 5, resource: { buffer: display3CInputResolution } },
        ]
    });

    const encoder = gpu.createCommandEncoder({ label: 'Anime4KDisplay3C-shader' });
    const pass = encoder.beginRenderPass({
        label: `Display3C-render-pass`,
        colorAttachments: [
            {
                view: output.createView(),
                clearValue: [0, 0, 0, 1],
                loadOp: 'clear',
                storeOp: 'store',
            },
        ],
    });

    pass.setPipeline(display3CPipeline);
    pass.setBindGroup(0, bindGroup);

    pass.draw(6);
    pass.end();
    gpu.queue.submit([encoder.finish()]);
}

const createUniform = (gpu: GPUDevice, label: string, value: GPUAllowSharedBufferSource) => {
    const buffer = gpu.createBuffer({
        label,
        size: value.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    gpu.queue.writeBuffer(buffer, 0, value);

    return buffer;
}

type WeightsEntryBuffers = {
    kernels: GPUBuffer,
    bias: GPUBuffer
}
const weightBuffersCache: Map<WeightsEntry, WeightsEntryBuffers> = new Map();
const getOrCreateWeightBuffer = (gpu: GPUDevice, weights: WeightsEntry, labelKernels: string, labelBias: string) => {
    const maybeBuffers = weightBuffersCache.get(weights);
    if (maybeBuffers !== undefined) {
        return maybeBuffers;
    }

    const buffers = {
        kernels: createUniform(gpu, labelKernels, new Float32Array(weights.weights)),
        bias: createUniform(gpu, labelBias, new Float32Array(weights.bias))
    };
    weightBuffersCache.set(weights, buffers);

    return buffers;
}