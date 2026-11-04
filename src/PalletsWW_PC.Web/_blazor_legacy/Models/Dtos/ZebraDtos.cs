using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace PalletsWW_PC.Web.Models.Dtos;

public record ZebraStatusDto(
    [property: JsonPropertyName("connected")] bool Connected = false,
    [property: JsonPropertyName("printerName")] string? PrinterName = null,
    [property: JsonPropertyName("port")] int Port = 0,
    [property: JsonPropertyName("message")] string? Message = null,
    [property: JsonPropertyName("isPaused")] bool IsPaused = false,
    [property: JsonPropertyName("isOffline")] bool IsOffline = false,
    [property: JsonPropertyName("isError")] bool IsError = false,
    [property: JsonPropertyName("cJobs")] uint CJobs = 0,
    [property: JsonPropertyName("statusDesc")] string? StatusDesc = null,
    [property: JsonPropertyName("printMode")] string? PrintMode = "USB",
    [property: JsonPropertyName("printerIp")] string? PrinterIp = "",
    [property: JsonPropertyName("printerPort")] int PrinterPort = 9100
);

public record ZebraPrintResultDto(
    [property: JsonPropertyName("success")] bool Success = false,
    [property: JsonPropertyName("port")] int Port = 0,
    [property: JsonPropertyName("message")] string? Message = null,
    [property: JsonPropertyName("isPaused")] bool IsPaused = false,
    [property: JsonPropertyName("cJobs")] uint CJobs = 0,
    [property: JsonPropertyName("mode")] string? Mode = null
);

public record MachineConfigDto(
    [property: JsonPropertyName("machineId")] int MachineId = 0,
    [property: JsonPropertyName("machineName")] string? MachineName = null,
    [property: JsonPropertyName("serverIp")] string? ServerIp = null
);

public record SaveServerResultDto(
    [property: JsonPropertyName("success")] bool Success = false,
    [property: JsonPropertyName("serverIp")] string? ServerIp = null,
    [property: JsonPropertyName("shortcutUpdated")] bool ShortcutUpdated = false
);

public record PrintersResultDto(
    [property: JsonPropertyName("selected")] string? Selected = null,
    [property: JsonPropertyName("printers")] List<string>? Printers = null,
    [property: JsonPropertyName("isPaused")] bool IsPaused = false,
    [property: JsonPropertyName("cJobs")] uint CJobs = 0,
    [property: JsonPropertyName("statusDesc")] string? StatusDesc = null
);

public record GenericJsResultDto(
    [property: JsonPropertyName("success")] bool Success = false,
    [property: JsonPropertyName("message")] string? Message = null,
    [property: JsonPropertyName("printerName")] string? PrinterName = null,
    [property: JsonPropertyName("isPaused")] bool IsPaused = false,
    [property: JsonPropertyName("cJobs")] uint CJobs = 0
);

public record HardwareConfigDto(
    [property: JsonPropertyName("machineId")] int MachineId = 0,
    [property: JsonPropertyName("machineName")] string? MachineName = null,
    [property: JsonPropertyName("serverIp")] string? ServerIp = null,
    [property: JsonPropertyName("printerName")] string? PrinterName = null,
    [property: JsonPropertyName("printMode")] string? PrintMode = "USB",
    [property: JsonPropertyName("printerIp")] string? PrinterIp = "",
    [property: JsonPropertyName("printerPort")] int PrinterPort = 9100
);

public record CheckNetworkResultDto(
    [property: JsonPropertyName("success")] bool Success = false,
    [property: JsonPropertyName("ip")] string? Ip = null,
    [property: JsonPropertyName("port")] int Port = 9100,
    [property: JsonPropertyName("message")] string? Message = null
);