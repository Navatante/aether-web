export const getSelectClassNames = (hasError: boolean, hasValue: boolean) => ({
  container: () => 'w-full min-w-0',
  control: (state: { isFocused: boolean }) =>
    ['react-select-control',
      hasError ? 'react-select-control--error' : hasValue ? 'react-select-control--filled' : '',
      state.isFocused ? 'react-select-control--focused' : ''
    ].filter(Boolean).join(' '),
  valueContainer: () => 'react-select-value-container',
  singleValue:    () => 'react-select-single-value',
  placeholder:    () => 'react-select-placeholder',
  input:          () => 'react-select-input',
  menu:           () => 'react-select-menu',
  menuList:       () => 'react-select-menu-list',
  option: (state: { isFocused: boolean; isSelected: boolean }) =>
    ['react-select-option',
      state.isFocused  ? 'react-select-option--focused'  : '',
      state.isSelected ? 'react-select-option--selected' : ''
    ].filter(Boolean).join(' '),
  indicatorSeparator: () => 'react-select-indicator-separator',
  dropdownIndicator:  () => 'react-select-dropdown-indicator',
  clearIndicator:     () => 'react-select-clear-indicator',
});

export const menuPortalStyles = {
  menuPortal: (base: Record<string, unknown>) => ({ ...base, pointerEvents: 'auto' as const, zIndex: 99999 }),
};
