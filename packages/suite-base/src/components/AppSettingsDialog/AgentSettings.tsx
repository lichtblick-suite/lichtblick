// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { makeStyles } from "tss-react/mui";

import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import { AgentMarkdown } from "@lichtblick/suite-base/components/AgentMarkdown";
import Stack from "@lichtblick/suite-base/components/Stack";
import { useAppConfiguration } from "@lichtblick/suite-base/context/AppConfigurationContext";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks/useAppConfigurationValue";
import { reportError } from "@lichtblick/suite-base/reportError";
import {
  AgentCredentialsBackendUnavailableError,
  AgentConfigurationErrors,
  AgentLlmProvider,
  AgentPlaintextCredentialLockUnavailableError,
  AgentProfile,
  AgentSettingsConflictError,
  AgentSettingsDraft,
  DEFAULT_AGENT_LLM_PROVIDER,
  DEFAULT_ANTHROPIC_MODEL,
  commitAgentSettings,
  createAgentSettingsDraft,
  selectAgentConfiguration,
  useAgentSettings,
  validateAgentConfiguration,
} from "@lichtblick/suite-base/services/agent/agentSettings";
import { SKILL_REGISTRY } from "@lichtblick/suite-base/services/agent/local/skills";
import {
  clearAgentMemories,
  readAgentMemories,
  removeAgentMemory,
} from "@lichtblick/suite-base/services/agent/memory/agentMemory";
import type { MemoryEntry } from "@lichtblick/suite-base/services/agent/memory/agentMemory";
import {
  readAgentPromptCustomization,
  resolveSkills,
  writeAgentPromptCustomization,
} from "@lichtblick/suite-base/services/agent/prompts/agentPrompts";
import type { AgentPromptCustomization } from "@lichtblick/suite-base/services/agent/prompts/agentPrompts";

const useStyles = makeStyles()((theme) => ({
  checkbox: {
    "&.MuiCheckbox-root": {
      paddingTop: 0,
    },
  },
  formControlLabel: {
    "&.MuiFormControlLabel-root": {
      alignItems: "start",
    },
  },
  skillPreview: {
    maxHeight: 420,
    padding: theme.spacing(1.5),
    overflowY: "auto",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.default,
  },
}));

export type AgentSettingsCommitHandler = () => Promise<boolean>;

type AgentSettingsFormProps = {
  desktop: boolean;
  onCommitHandlerChange?: (
    handler: AgentSettingsCommitHandler | undefined,
  ) => void;
};

function createAgentProfileId(): string {
  if (typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`.slice(
    0,
    64,
  );
}

function nextAgentProfileName(profiles: readonly AgentProfile[]): string {
  const profileNames = new Set(profiles.map((profile) => profile.name));
  let index = 1;
  while (profileNames.has(`Profile ${index}`)) {
    index++;
  }
  return `Profile ${index}`;
}

function uniqueAgentProfileName(
  profiles: readonly AgentProfile[],
  preferredName: string,
): string {
  const profileNames = new Set(profiles.map((profile) => profile.name));
  if (!profileNames.has(preferredName)) {
    return preferredName;
  }
  let index = 2;
  while (profileNames.has(`${preferredName} ${index}`)) {
    index++;
  }
  return `${preferredName} ${index}`;
}

function createBlankAgentProfile(
  profiles: readonly AgentProfile[],
): AgentProfile {
  return {
    anthropic: {
      apiKey: "",
      baseUrl: "",
      model: DEFAULT_ANTHROPIC_MODEL,
    },
    id: createAgentProfileId(),
    name: nextAgentProfileName(profiles),
    openAiCompatible: {
      apiKey: "",
      baseUrl: "",
      model: "",
    },
    provider: DEFAULT_AGENT_LLM_PROVIDER,
  };
}

function AgentSettingsForm({
  desktop,
  onCommitHandlerChange,
}: AgentSettingsFormProps): React.ReactElement {
  const { t } = useTranslation("appSettings");
  const { classes } = useStyles();
  const appConfiguration = useAppConfiguration();
  const [agentEnabled = false, setAgentEnabled] =
    useAppConfigurationValue<boolean>(AppSetting.AGENT_ENABLED);
  const {
    credentialBackendUnavailable,
    migrationError,
    migrationReady,
    snapshot,
  } = useAgentSettings(appConfiguration, { desktop });
  const [draft, setDraft] = useState<AgentSettingsDraft>(() =>
    createAgentSettingsDraft(snapshot),
  );
  const [selectedProfileId, setSelectedProfileId] = useState(
    () => draft.activeProfileId ?? draft.profiles?.[0]?.id ?? "",
  );
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [plaintextLockUnavailable, setPlaintextLockUnavailable] =
    useState(false);
  const [revisionConflict, setRevisionConflict] = useState(false);
  const commitInFlightRef = useRef<Promise<boolean>>();

  useEffect(() => {
    if (!migrationReady) {
      return;
    }
    if (
      draft.revision !== snapshot.revision &&
      commitInFlightRef.current == undefined
    ) {
      if (dirty) {
        setRevisionConflict(true);
      }
      setDirty(false);
      const nextDraft = createAgentSettingsDraft(snapshot);
      setDraft(nextDraft);
      setSelectedProfileId((current) =>
        nextDraft.profiles?.some((profile) => profile.id === current) === true
          ? current
          : (nextDraft.activeProfileId ?? nextDraft.profiles?.[0]?.id ?? ""),
      );
    } else if (!dirty) {
      const nextDraft = createAgentSettingsDraft(snapshot);
      setDraft(nextDraft);
      setSelectedProfileId((current) =>
        nextDraft.profiles?.some((profile) => profile.id === current) === true
          ? current
          : (nextDraft.activeProfileId ?? nextDraft.profiles?.[0]?.id ?? ""),
      );
    }
  }, [dirty, draft.revision, migrationReady, snapshot]);

  const formReady = migrationReady && draft.revision === snapshot.revision;

  const profiles = useMemo(() => draft.profiles ?? [], [draft.profiles]);
  const selectedProfile = profiles.find(
    (profile) => profile.id === selectedProfileId,
  );
  const providerSettings =
    selectedProfile?.provider === "openai-compatible"
      ? selectedProfile.openAiCompatible
      : selectedProfile?.anthropic;
  const selectedConfiguration = selectAgentConfiguration(
    {
      ...draft,
      credentialResaveRequired: snapshot.credentialResaveRequired,
      credentialStorage: snapshot.credentialStorage,
      revision: snapshot.revision,
      storageError: snapshot.storageError,
    },
    { desktop, profileId: selectedProfileId },
  );
  const errors = validateAgentConfiguration(selectedConfiguration);

  const markDraftDirty = useCallback(() => {
    setDirty(true);
    setRevisionConflict(false);
    setSaveFailed(false);
  }, []);

  const updateSelectedProfile = useCallback(
    (update: (profile: AgentProfile) => AgentProfile) => {
      markDraftDirty();
      setDraft((current) => ({
        ...current,
        profiles: current.profiles?.map((profile) =>
          profile.id === selectedProfileId ? update(profile) : profile,
        ),
      }));
    },
    [markDraftDirty, selectedProfileId],
  );

  const updateProviderSettings = useCallback(
    (update: Partial<AgentSettingsDraft["anthropic"]>) => {
      updateSelectedProfile((profile) => {
        const key =
          profile.provider === "anthropic" ? "anthropic" : "openAiCompatible";
        return {
          ...profile,
          [key]: { ...profile[key], ...update },
        };
      });
    },
    [updateSelectedProfile],
  );

  const createProfile = useCallback(() => {
    const profile = createBlankAgentProfile(profiles);
    markDraftDirty();
    setDraft((current) => ({
      ...current,
      profiles: [...(current.profiles ?? []), profile],
    }));
    setSelectedProfileId(profile.id);
  }, [markDraftDirty, profiles]);

  const copyProfile = useCallback(() => {
    if (selectedProfile == undefined) {
      return;
    }
    const copy: AgentProfile = {
      ...selectedProfile,
      anthropic: { ...selectedProfile.anthropic },
      id: createAgentProfileId(),
      name: uniqueAgentProfileName(
        profiles,
        t("agentProfileCopyName", { name: selectedProfile.name }),
      ),
      openAiCompatible: { ...selectedProfile.openAiCompatible },
    };
    markDraftDirty();
    setDraft((current) => ({
      ...current,
      profiles: [...(current.profiles ?? []), copy],
    }));
    setSelectedProfileId(copy.id);
  }, [markDraftDirty, profiles, selectedProfile, t]);

  const openRenameProfile = useCallback(() => {
    if (selectedProfile == undefined) {
      return;
    }
    setRenameValue(selectedProfile.name);
    setRenameOpen(true);
  }, [selectedProfile]);

  const renameProfile = useCallback(() => {
    const name = renameValue.trim();
    if (selectedProfile == undefined || name === "") {
      return;
    }
    updateSelectedProfile((profile) => ({ ...profile, name }));
    setRenameOpen(false);
  }, [renameValue, selectedProfile, updateSelectedProfile]);

  const deleteProfile = useCallback(() => {
    if (selectedProfile == undefined || profiles.length <= 1) {
      return;
    }
    const remainingProfiles = profiles.filter(
      (profile) => profile.id !== selectedProfile.id,
    );
    const nextSelectedProfile = remainingProfiles[0];
    if (nextSelectedProfile == undefined) {
      return;
    }
    markDraftDirty();
    setDraft((current) => ({
      ...current,
      activeProfileId:
        current.activeProfileId === selectedProfile.id
          ? nextSelectedProfile.id
          : current.activeProfileId,
      profiles: remainingProfiles,
    }));
    setSelectedProfileId(nextSelectedProfile.id);
  }, [markDraftDirty, profiles, selectedProfile]);

  const setDefaultProfile = useCallback(() => {
    if (
      selectedProfile == undefined ||
      draft.activeProfileId === selectedProfile.id
    ) {
      return;
    }
    markDraftDirty();
    setDraft((current) => ({
      ...current,
      activeProfileId: selectedProfile.id,
    }));
  }, [draft.activeProfileId, markDraftDirty, selectedProfile]);

  const commit = useCallback(async (): Promise<boolean> => {
    if (commitInFlightRef.current != undefined) {
      return await commitInFlightRef.current;
    }
    if (!dirty && !snapshot.credentialResaveRequired) {
      return true;
    }
    if (!formReady) {
      return false;
    }
    const pending = (async () => {
      setSaving(true);
      setSaveFailed(false);
      setPlaintextLockUnavailable(false);
      try {
        await commitAgentSettings(appConfiguration, draft, { desktop });
        setDirty(false);
        return true;
      } catch (error) {
        if (error instanceof AgentSettingsConflictError) {
          setRevisionConflict(true);
          setDirty(false);
        } else if (error instanceof AgentCredentialsBackendUnavailableError) {
          setSaveFailed(false);
        } else if (
          error instanceof AgentPlaintextCredentialLockUnavailableError
        ) {
          setPlaintextLockUnavailable(true);
          setSaveFailed(false);
        } else {
          setSaveFailed(true);
          reportError(error);
        }
        return false;
      } finally {
        setSaving(false);
      }
    })();
    commitInFlightRef.current = pending;
    try {
      return await pending;
    } finally {
      if (commitInFlightRef.current === pending) {
        commitInFlightRef.current = undefined;
      }
    }
  }, [
    appConfiguration,
    desktop,
    dirty,
    draft,
    formReady,
    snapshot.credentialResaveRequired,
  ]);

  useEffect(() => {
    onCommitHandlerChange?.(commit);
    return () => {
      onCommitHandlerChange?.(undefined);
    };
  }, [commit, onCommitHandlerChange]);

  const helperText = (
    error: AgentConfigurationErrors[keyof AgentConfigurationErrors],
  ) => {
    if (error === "required") {
      return t("agentFieldRequired");
    }
    if (error === "invalidUrl") {
      return t("agentInvalidUrl");
    }
    return undefined;
  };

  return (
    <Stack gap={2}>
      <FormControl>
        <FormControlLabel
          className={classes.formControlLabel}
          control={
            <Checkbox
              className={classes.checkbox}
              checked={agentEnabled}
              onChange={(_event, checked) => void setAgentEnabled(checked)}
            />
          }
          label={t("agentEnable")}
        />
        <FormHelperText>{t("agentEnableHelp")}</FormHelperText>
      </FormControl>
      <Alert severity={Object.keys(errors).length === 0 ? "success" : "info"}>
        {Object.keys(errors).length === 0
          ? t("agentConfigured")
          : t("agentNotConfigured")}
      </Alert>
      {(credentialBackendUnavailable ||
        migrationError instanceof AgentCredentialsBackendUnavailableError) && (
        <Alert severity="warning">
          {t("agentCredentialBackendUnavailable")}
        </Alert>
      )}
      {(snapshot.storageError ||
        (migrationError != undefined &&
          !(
            migrationError instanceof AgentCredentialsBackendUnavailableError
          )) ||
        saveFailed) && (
        <Alert severity="error">{t("agentSettingsStorageError")}</Alert>
      )}
      {!migrationReady && migrationError == undefined && (
        <Alert severity="info">{t("agentSettingsLoading")}</Alert>
      )}
      {revisionConflict && (
        <Alert severity="warning">{t("agentSettingsRevisionConflict")}</Alert>
      )}
      {plaintextLockUnavailable && (
        <Alert severity="warning">{t("agentPlaintextLockUnavailable")}</Alert>
      )}
      <Stack direction="row" gap={1} alignItems="flex-end">
        <FormControl fullWidth>
          <FormLabel id="agent-profile-label">{t("agentProfile")}:</FormLabel>
          <Select<string>
            disabled={saving || !formReady}
            inputProps={{ "aria-label": t("agentProfile") }}
            value={selectedProfileId}
            onChange={(event) => {
              setSelectedProfileId(event.target.value);
              setRenameOpen(false);
            }}
          >
            {profiles.map((profile) => (
              <MenuItem key={profile.id} value={profile.id}>
                {profile.name}
                {profile.id === draft.activeProfileId
                  ? ` (${t("agentProfileActive")})`
                  : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <IconButton
          aria-label={t("agentProfileCreate")}
          disabled={saving || !formReady}
          onClick={createProfile}
        >
          <AddOutlinedIcon />
        </IconButton>
        <IconButton
          aria-label={t("agentProfileCopy")}
          disabled={saving || !formReady || selectedProfile == undefined}
          onClick={copyProfile}
        >
          <ContentCopyOutlinedIcon />
        </IconButton>
        <IconButton
          aria-label={t("agentProfileRename")}
          disabled={saving || !formReady || selectedProfile == undefined}
          onClick={openRenameProfile}
        >
          <EditOutlinedIcon />
        </IconButton>
        <IconButton
          aria-label={t("agentProfileDelete")}
          disabled={
            saving ||
            !formReady ||
            selectedProfile == undefined ||
            profiles.length <= 1
          }
          onClick={deleteProfile}
        >
          <DeleteOutlineIcon />
        </IconButton>
      </Stack>
      <Button
        disabled={
          saving ||
          !formReady ||
          selectedProfile == undefined ||
          selectedProfile.id === draft.activeProfileId
        }
        onClick={setDefaultProfile}
        size="small"
        variant="outlined"
      >
        {t("agentProfileSetDefault")}
      </Button>
      <Dialog
        open={renameOpen}
        onClose={() => {
          setRenameOpen(false);
        }}
      >
        <DialogTitle>{t("agentProfileRenameTitle")}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label={t("agentProfileName")}
            margin="dense"
            value={renameValue}
            onChange={(event) => {
              setRenameValue(event.target.value);
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setRenameOpen(false);
            }}
          >
            {t("agentProfileRenameCancel")}
          </Button>
          <Button
            disabled={renameValue.trim() === ""}
            onClick={renameProfile}
            variant="contained"
          >
            {t("agentProfileRenameSave")}
          </Button>
        </DialogActions>
      </Dialog>
      <FormControl fullWidth>
        <FormLabel id="agent-llm-provider-label">
          {t("agentLlmProvider")}:
        </FormLabel>
        <Select<AgentLlmProvider>
          disabled={saving || !formReady}
          inputProps={{ "aria-label": t("agentLlmProvider") }}
          value={selectedProfile?.provider ?? DEFAULT_AGENT_LLM_PROVIDER}
          onChange={(event) => {
            updateSelectedProfile((profile) => ({
              ...profile,
              provider: event.target.value,
            }));
          }}
        >
          <MenuItem value="anthropic">{t("agentProviderAnthropic")}</MenuItem>
          <MenuItem value="openai-compatible">
            {t("agentProviderOpenAICompatible")}
          </MenuItem>
        </Select>
      </FormControl>
      <TextField
        disabled={saving || !formReady}
        fullWidth
        label={t("agentLlmModel")}
        value={providerSettings?.model ?? ""}
        error={errors.model != undefined}
        helperText={helperText(errors.model)}
        onChange={(event) => {
          updateProviderSettings({ model: event.target.value });
        }}
      />
      <TextField
        disabled={saving || !formReady}
        fullWidth
        type="password"
        autoComplete="off"
        label={t("agentLlmApiKey")}
        value={providerSettings?.apiKey ?? ""}
        error={errors.apiKey != undefined}
        helperText={helperText(errors.apiKey)}
        onChange={(event) => {
          updateProviderSettings({ apiKey: event.target.value });
        }}
      />
      <Alert
        severity={
          desktop && snapshot.credentialStorage === "secure"
            ? "info"
            : "warning"
        }
      >
        {desktop && snapshot.credentialStorage === "secure"
          ? t("agentDesktopCredentialStorageInfo")
          : desktop && snapshot.credentialResaveRequired
            ? t("agentDesktopLegacyPlaintextCredentialStorageWarning")
            : desktop
              ? t("agentDesktopPlaintextCredentialStorageWarning")
              : t("agentWebCredentialStorageWarning")}
      </Alert>
      <TextField
        disabled={saving || !formReady}
        fullWidth
        type="url"
        label={t("agentLlmBaseUrl")}
        value={providerSettings?.baseUrl ?? ""}
        error={errors.baseUrl != undefined}
        helperText={helperText(errors.baseUrl)}
        onChange={(event) => {
          updateProviderSettings({ baseUrl: event.target.value });
        }}
      />
      <Button
        disabled={
          (!dirty && !snapshot.credentialResaveRequired) || saving || !formReady
        }
        onClick={() => void commit()}
        variant="contained"
      >
        {saving ? t("agentSaving") : t("agentSave")}
      </Button>
      <Divider />
      <AgentPromptSettings />
      <Divider />
      <AgentMemorySettings />
    </Stack>
  );
}

/**
 * Editing surface for the agent's instructions and skills.
 *
 * Edits are held locally and written on save so a half-typed skill body never reaches a live
 * conversation. Built-in skills are edited as overrides, so "Reset" always restores the shipped
 * text even after the built-in has been updated.
 */
type SkillView = "edit" | "preview";

function AgentPromptSettings(): React.ReactElement {
  const { classes } = useStyles();
  const { t } = useTranslation("appSettings");
  const appConfiguration = useAppConfiguration();
  const [draft, setDraft] = useState<AgentPromptCustomization>(() =>
    readAgentPromptCustomization(appConfiguration),
  );
  const [selectedSkillId, setSelectedSkillId] = useState<string>("");
  const [skillView, setSkillView] = useState<SkillView>("edit");
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  const skills = useMemo(() => resolveSkills(draft), [draft]);
  const selectedSkill = skills.find((skill) => skill.id === selectedSkillId);
  const isBuiltIn =
    selectedSkill != undefined && SKILL_REGISTRY.has(selectedSkill.id);
  const isOverridden =
    selectedSkill != undefined &&
    draft.skillOverrides[selectedSkill.id] != undefined;

  const update = (next: AgentPromptCustomization) => {
    setDraft(next);
    setSaved(false);
    setError(undefined);
  };

  const save = async () => {
    try {
      await writeAgentPromptCustomization(appConfiguration, draft);
      setError(undefined);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setSaved(false);
    }
  };

  return (
    <Stack gap={1.5}>
      <FormLabel>{t("agentPrompt")}:</FormLabel>
      <FormHelperText>{t("agentPromptHelp")}</FormHelperText>

      <TextField
        fullWidth
        multiline
        minRows={3}
        label={t("agentInstructions")}
        placeholder={t("agentInstructionsPlaceholder")}
        value={draft.instructions}
        onChange={(event) => {
          update({ ...draft, instructions: event.target.value });
        }}
      />

      <FormControl fullWidth>
        <FormLabel id="agent-skill-label">{t("agentSkills")}:</FormLabel>
        <Select<string>
          displayEmpty
          inputProps={{ "aria-label": t("agentSkills") }}
          value={selectedSkillId}
          onChange={(event) => {
            setSelectedSkillId(event.target.value);
          }}
        >
          <MenuItem value="">{t("agentSkillSelect")}</MenuItem>
          {skills.map((skill) => (
            <MenuItem key={skill.id} value={skill.id}>
              {skill.id}
              {draft.skillOverrides[skill.id] != undefined
                ? ` ${t("agentSkillEdited")}`
                : ""}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {selectedSkill != undefined && (
        <>
          <FormHelperText>{selectedSkill.whenToUse}</FormHelperText>
          <ToggleButtonGroup
            color="primary"
            exclusive
            size="small"
            value={skillView}
            onChange={(_event, next?: SkillView) => {
              if (next != undefined) {
                setSkillView(next);
              }
            }}
          >
            <ToggleButton value="edit">{t("agentSkillEdit")}</ToggleButton>
            <ToggleButton value="preview">
              {t("agentSkillPreview")}
            </ToggleButton>
          </ToggleButtonGroup>
          {skillView === "preview" ? (
            // Skills are markdown and the agent consumes them as such; previewing the rendered form
            // is how you catch a broken table or an unclosed fence before the agent reads it.
            <div
              className={classes.skillPreview}
              data-testid="agent-skill-preview"
            >
              <AgentMarkdown>{selectedSkill.body}</AgentMarkdown>
            </div>
          ) : (
            <TextField
              fullWidth
              multiline
              minRows={8}
              maxRows={20}
              label={selectedSkill.name}
              value={selectedSkill.body}
              onChange={(event) => {
                const body = event.target.value;
                if (isBuiltIn) {
                  update({
                    ...draft,
                    skillOverrides: {
                      ...draft.skillOverrides,
                      [selectedSkill.id]: body,
                    },
                  });
                } else {
                  update({
                    ...draft,
                    customSkills: draft.customSkills.map((skill) =>
                      skill.id === selectedSkill.id
                        ? { ...skill, body }
                        : skill,
                    ),
                  });
                }
              }}
            />
          )}
          {isBuiltIn ? (
            <Button
              disabled={!isOverridden}
              onClick={() => {
                const { [selectedSkill.id]: _removed, ...rest } =
                  draft.skillOverrides;
                update({ ...draft, skillOverrides: rest });
              }}
            >
              {t("agentSkillReset")}
            </Button>
          ) : (
            <Button
              color="error"
              onClick={() => {
                update({
                  ...draft,
                  customSkills: draft.customSkills.filter(
                    (skill) => skill.id !== selectedSkill.id,
                  ),
                });
                setSelectedSkillId("");
              }}
            >
              {t("agentSkillDelete")}
            </Button>
          )}
        </>
      )}

      <Button
        onClick={() => {
          const index = draft.customSkills.length + 1;
          const id = `custom-skill-${String(index)}`;
          update({
            ...draft,
            customSkills: [
              ...draft.customSkills,
              {
                id,
                name: t("agentSkillNewName"),
                whenToUse: t("agentSkillNewWhenToUse"),
                body: t("agentSkillNewBody"),
              },
            ],
          });
          setSelectedSkillId(id);
        }}
      >
        {t("agentSkillAdd")}
      </Button>

      {error != undefined && <Alert severity="error">{error}</Alert>}
      {saved && <Alert severity="success">{t("agentPromptSaved")}</Alert>}

      <Button onClick={() => void save()} variant="contained">
        {t("agentPromptSave")}
      </Button>
    </Stack>
  );
}

/**
 * Memory is written by the agent itself, so this exists to keep the user in control of what was
 * kept. Deletions apply immediately rather than through the credential draft/commit flow, because
 * memories are ordinary configuration, not secrets.
 */
function AgentMemorySettings(): React.ReactElement {
  const { t } = useTranslation("appSettings");
  const appConfiguration = useAppConfiguration();
  const [memories, setMemories] = useState<MemoryEntry[]>(() =>
    readAgentMemories(appConfiguration),
  );

  useEffect(() => {
    const listener = () => {
      setMemories(readAgentMemories(appConfiguration));
    };
    appConfiguration.addChangeListener(AppSetting.AGENT_MEMORY, listener);
    return () => {
      appConfiguration.removeChangeListener(AppSetting.AGENT_MEMORY, listener);
    };
  }, [appConfiguration]);

  return (
    <Stack gap={1}>
      <FormLabel>{t("agentMemory")}:</FormLabel>
      <FormHelperText>{t("agentMemoryHelp")}</FormHelperText>
      {memories.length === 0 ? (
        <FormHelperText>{t("agentMemoryEmpty")}</FormHelperText>
      ) : (
        <>
          <List dense disablePadding>
            {memories.map((memory) => (
              <ListItem
                key={memory.id}
                disableGutters
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label={t("agentMemoryForget", { text: memory.text })}
                    onClick={() =>
                      void removeAgentMemory(appConfiguration, memory.id)
                    }
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemText primary={memory.text} />
              </ListItem>
            ))}
          </List>
          <Button
            color="error"
            onClick={() => void clearAgentMemories(appConfiguration)}
            variant="outlined"
          >
            {t("agentMemoryClear")}
          </Button>
        </>
      )}
    </Stack>
  );
}

export function AgentSettings({
  isDesktop,
  onCommitHandlerChange,
}: {
  isDesktop: boolean;
  onCommitHandlerChange?: (
    handler: AgentSettingsCommitHandler | undefined,
  ) => void;
}): React.ReactElement {
  return (
    <AgentSettingsForm
      desktop={isDesktop}
      onCommitHandlerChange={onCommitHandlerChange}
    />
  );
}
