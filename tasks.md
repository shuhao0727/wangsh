# Tasks: Fix Article Editor Height

- [ ] **Step 1: Refactor `EditForm.css`** <!-- id: 0 -->
    - [ ] Define `.article-edit-form` and `.ant-form` layout.
    - [ ] Define Grid layout and ensure it fills the Form.
    - [ ] Define Card and Card Body layout (Flex Column, Flex 1).
    - [ ] Define `Form.Item` internal layout (Control -> Input -> Content -> Wrapper).
    - [ ] Define `TextArea` wrapper (`.ant-input-affix-wrapper`) layout.
    - [ ] Define `TextArea` element layout.
- [ ] **Step 2: Clean up `EditForm.tsx`** <!-- id: 1 -->
    - [ ] Remove conflicting inline styles on Cards and Form Items.
    - [ ] Ensure class names match the new CSS.
- [ ] **Step 3: Verify and Deploy** <!-- id: 2 -->
    - [ ] Build Docker image.
    - [ ] Deploy.
    - [ ] Verify in browser.
