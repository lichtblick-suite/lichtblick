constraints_min_version(1).

% Convert between an atom and a number
atom_number(Atom, Number) :-
  atom_chars(Atom, Chars),
  number_chars(Number, Chars).

% Parse an atom such as '1.2.3' into Major=1, Minor=2, Patch=3.
semver(Atom, Major, Minor, Patch) :-
  atom_chars(Atom, Chars),
  nth0(I, Chars, '.'),
  nth0(J, Chars, '.'),
  I < J,
  MinorLen is J - I - 1,
  MinorStart is I + 1,
  PatchStart is J + 1,
  sub_atom(Atom, 0, I, _, MajorAtom),
  sub_atom(Atom, MinorStart, MinorLen, _, MinorAtom),
  sub_atom(Atom, PatchStart, _, 0, PatchAtom),
  atom_number(MajorAtom, Major),
  atom_number(MinorAtom, Minor),
  atom_number(PatchAtom, Patch).

% True if Major1.Minor1.Patch1 is less than Major2.Minor2.Patch2
semver_less(Major1, Minor1, Patch1, Major2, Minor2, Patch2) :-
  Major1 < Major2;
  Major1 == Major2, Minor1 < Minor2;
  Major1 == Major2, Minor1 == Minor2, Patch1 < Patch2.

% Find the maximum version in a given list of semver atoms, e.g. semver_max(['1.0.0', '2.0.0'], '2.0.0').
semver_max([Version], Version).
semver_max([First|Rest], Result) :-
  semver_max(Rest, RestMax),
  semver(First, Major1, Minor1, Patch1),
  semver(RestMax, Major2, Minor2, Patch2),
  (semver_less(Major2, Minor2, Patch2, Major1, Minor1, Patch1) -> Result = First; Result = RestMax).


% True if Prefix occurs at the beginning of Atom.
has_prefix(Prefix, Atom) :-
  atom_concat(Prefix, _, Atom).

% Find all unique dependency versions across all workspaces that have a given Prefix, or are in
% Includes, excluding any dependencies in Excludes.
all_versions_in_group(Group, Result) :-
  findall(
    Range,
    (
      workspace_has_dependency(_, Dep, Range, _),
      version_group(Dep, Group)
    ),
    ResultList
  ),
  list_to_set(ResultList, Result).

% Define version groups for dependencies. All dependencies in the same group will be required to have the same version.
version_group(Dep, storybook) :-
  Dep = 'storybook';
  has_prefix('@storybook/', Dep), Dep \= '@storybook/testing-library'.
version_group(Dep, typescript_eslint) :-
  has_prefix('@typescript-eslint/', Dep).
version_group(Dep, emotion) :-
  has_prefix('@emotion/', Dep).

% Enforce the requirements defined on version groups above.
gen_enforced_dependency(WorkspaceCwd, DependencyIdent, DependencyRange, DependencyType) :-
  write('Generating '), write(DependencyType), write(' requirements for '), write(WorkspaceCwd), nl,
  % For each existing package dependency...
  workspace_has_dependency(WorkspaceCwd, DependencyIdent, _, DependencyType),
  % Get the dependency's version group.
  version_group(DependencyIdent, Group),
  % Find the maximum version for dependencies with this Prefix across all workspaces & packages, and
  % require this package to have that version.
  all_versions_in_group(Group, Versions),
  semver_max(Versions, MaxVersion),
  write('Applying maximum '), write(Group), write(' package version '), write(MaxVersion), write(' to '), write(DependencyIdent), nl,
  DependencyRange = MaxVersion.
