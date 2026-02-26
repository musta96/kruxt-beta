import React, { useEffect, useState } from "react";
import type {
  ClassSchedulingCatalogInput,
  ClassTemplateOption,
  OpsConsoleServices
} from "../ops-console/runtime-services";

export interface AdminSettingsFlowProps {
  services: OpsConsoleServices;
  gymId: string;
}

function ensureTemplateId(template: ClassTemplateOption): ClassTemplateOption {
  if (template.id) return template;
  return {
    ...template,
    id: `template_${Math.random().toString(36).slice(2, 10)}`
  };
}

export function AdminSettingsFlow({ services, gymId }: AdminSettingsFlowProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [locationInput, setLocationInput] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [templates, setTemplates] = useState<ClassTemplateOption[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const options = await services.listClassSchedulingOptions(gymId);
        if (!active) return;
        setLocations(options.locations);
        setTemplates(options.templates.map(ensureTemplateId));
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load class catalog.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [gymId, services]);

  const availableLocations = React.useMemo(
    () => locations.filter((item) => item.trim().length > 0),
    [locations]
  );

  const addLocation = () => {
    const name = locationInput.trim();
    if (!name) return;
    if (locations.some((item) => item.toLowerCase() === name.toLowerCase())) {
      setLocationInput("");
      return;
    }
    setLocations((prev) => [...prev, name]);
    setLocationInput("");
    setSuccess(null);
  };

  const removeLocation = (name: string) => {
    setLocations((prev) => prev.filter((item) => item !== name));
    setTemplates((prev) => prev.filter((item) => item.location !== name));
    setSuccess(null);
  };

  const addTemplate = () => {
    const firstLocation = availableLocations[0] ?? "Main Floor";
    if (!availableLocations.length) {
      setLocations([firstLocation]);
    }
    setTemplates((prev) => [
      ...prev,
      {
        id: `template_${Math.random().toString(36).slice(2, 10)}`,
        name: "New Course",
        location: firstLocation,
        defaultCapacity: 12,
        defaultDurationMinutes: 60
      }
    ]);
    setSuccess(null);
  };

  const updateTemplate = (id: string, patch: Partial<ClassTemplateOption>) => {
    setTemplates((prev) =>
      prev.map((template) => (template.id === id ? { ...template, ...patch } : template))
    );
    setSuccess(null);
  };

  const removeTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((template) => template.id !== id));
    setSuccess(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const cleanInput: ClassSchedulingCatalogInput = {
      locations: availableLocations,
      templates: templates
        .map((template) => ({
          ...template,
          name: template.name.trim(),
          location: template.location.trim(),
          defaultCapacity: Math.max(1, Math.floor(template.defaultCapacity || 1)),
          defaultDurationMinutes: Math.max(15, Math.floor(template.defaultDurationMinutes || 60))
        }))
        .filter((template) => template.name && template.location)
    };

    const result = await services.saveClassSchedulingOptions(gymId, cleanInput);
    if (!result.ok) {
      setError(result.error?.message ?? "Unable to save settings.");
      setSaving(false);
      return;
    }

    setLocations(result.options?.locations ?? cleanInput.locations);
    setTemplates(result.options?.templates ?? cleanInput.templates);
    setSuccess("Catalog saved. Class scheduler dropdowns are now updated.");
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="panel p-4">
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton h-3 w-full mt-3" />
          <div className="skeleton h-3 w-2/3 mt-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="panel p-5 space-y-2">
        <h1 className="text-xl font-display font-bold text-foreground">Admin Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage gym locations and course templates used in class scheduling.
        </p>
        <p className="text-xs text-muted-foreground">
          Staff roles and authorizations are managed in <span className="font-semibold text-foreground">Members</span>.
        </p>
      </div>

      {error && (
        <div className="panel border-destructive/40 bg-destructive/10 p-3">
          <p className="text-destructive text-sm font-semibold">{error}</p>
        </div>
      )}
      {success && (
        <div className="panel border-success/40 bg-success/10 p-3">
          <p className="text-success text-sm font-semibold">{success}</p>
        </div>
      )}

      <div className="panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-display font-bold text-foreground">Locations</h2>
        </div>

        <div className="flex gap-2">
          <input
            className="input-field"
            placeholder="Add location (e.g. Wellness Zone)"
            value={locationInput}
            onChange={(event) => setLocationInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addLocation();
              }
            }}
          />
          <button type="button" className="btn-compact" onClick={addLocation}>
            Add
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {availableLocations.length === 0 && (
            <span className="text-xs text-muted-foreground">No locations configured yet.</span>
          )}
          {availableLocations.map((location) => (
            <span key={location} className="badge-steel inline-flex items-center gap-2">
              {location}
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-destructive"
                onClick={() => removeLocation(location)}
                aria-label={`Remove ${location}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="panel p-5 space-y-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-display font-bold text-foreground">Courses Offered</h2>
          <button type="button" className="btn-compact" onClick={addTemplate}>
            + Add Course
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Course Name</th>
              <th>Location</th>
              <th>Default Capacity</th>
              <th>Default Duration</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted-foreground text-sm py-6">
                  No courses configured yet.
                </td>
              </tr>
            )}
            {templates.map((template) => (
              <tr key={template.id}>
                <td>
                  <input
                    className="input-field"
                    value={template.name}
                    onChange={(event) => updateTemplate(template.id, { name: event.target.value })}
                    placeholder="Course name"
                  />
                </td>
                <td>
                  <select
                    className="input-field"
                    value={template.location}
                    onChange={(event) => updateTemplate(template.id, { location: event.target.value })}
                  >
                    {availableLocations.map((location) => (
                      <option key={location} value={location}>{location}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className="input-field"
                    type="number"
                    min={1}
                    value={template.defaultCapacity}
                    onChange={(event) =>
                      updateTemplate(template.id, {
                        defaultCapacity: Math.max(1, Number(event.target.value) || 1)
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    className="input-field"
                    type="number"
                    min={15}
                    step={5}
                    value={template.defaultDurationMinutes}
                    onChange={(event) =>
                      updateTemplate(template.id, {
                        defaultDurationMinutes: Math.max(15, Number(event.target.value) || 60)
                      })
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn-compact"
                    onClick={() => removeTemplate(template.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button type="button" className="btn-primary w-auto px-6" onClick={() => { void handleSave(); }} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
