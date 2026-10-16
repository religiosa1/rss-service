// Package version exposes the build version string of the application.
package version

import "runtime/debug"

// override is set at link time with -ldflags "-X ...version.override=v1.2.3",
// for builds without a git checkout (e.g. docker, where .git is not in context).
var override string

// String returns the human-readable build version. For release builds it is the
// module version; for local (devel) builds it falls back to the VCS revision,
// suffixed with " dirty" when the working tree had uncommitted changes.
func String() string {
	if override != "" {
		return override
	}

	info, ok := debug.ReadBuildInfo()
	if !ok {
		return "unknown"
	}

	version := info.Main.Version
	if version == "(devel)" {
		var commit string
		var dirty bool
		for _, setting := range info.Settings {
			if setting.Key == "vcs.revision" {
				commit = setting.Value
			}
			if setting.Key == "vcs.modified" {
				dirty = setting.Value == "true"
			}
		}
		if commit != "" {
			version += " " + commit
		}
		if dirty {
			version += " dirty"
		}
	}

	return version
}
