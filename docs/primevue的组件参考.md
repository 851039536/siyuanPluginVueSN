# 组件参考（精简版）

# Checkbox

```ts
import Checkbox from 'primevue/checkbox'
import CheckboxGroup from 'primevue/checkboxgroup'
```

## Basic

Binary checkbox is used with the *v-model* for two-way value binding and the *binary* property.

```ts
<template>
    <div class="card flex justify-center">
        <Checkbox v-model="checked" binary />
    </div>
</template>

<script setup>
import { ref } from "vue";
const checked = ref(false);
</script>
```

# ColorPicker

ColorPicker is an input component to select a color.

## Import

```ts
import ColorPicker from 'primevue/colorpicker'
```

## Basic

ColorPicker is used with the *v-model* property for two-way value binding.

```ts
<template>
    <div class="card flex justify-center">
        <ColorPicker v-model="color" />
    </div>
</template>

<script setup>
import { ref } from "vue";
const color = ref();
</script>
```

# DatePicker

DatePicker is a form component for date inputs.

## Import

```javascript
import DatePicker from 'primevue/datepicker'
```

## Basic

DatePicker is used with the *v-model* property for two-way value binding.

```ts
<template>
    <div class="card flex justify-center">
        <DatePicker v-model="date" />
    </div>
</template>

<script setup>
import { ref } from "vue";
const date = ref();
</script>
```

# Listbox

Listbox is used to select one or more values from a list of items.

## Import

```javascript

import Listbox from 'primevue/listbox'
```

## Basic

Listbox is used with the *v-model* property for two-way value binding along with the *options* collection. Label and value of an option are defined with the *optionLabel* and *optionValue* properties respectively. Note that, when options are simple primitive values such as a string array, no *optionLabel* and *optionValue* would be necessary.

```ts

<template>
    <div class="card flex justify-center">
        <Listbox v-model="selectedCity" :options="cities" optionLabel="name" class="w-full md:w-56" />
    </div>
</template>

<script setup>
import { ref } from "vue";

const selectedCity = ref();
const cities = ref([
    { name: 'New York', code: 'NY' },
    { name: 'Paris', code: 'PRS' }
]);
</script>
```

# Password

Password displays strength indicator for password fields.

## Import

```javascript
import Password from 'primevue/password'
```

## Basic

Password is used with the *v-model* property for two-way value binding.

```ts
<template>
    <div class="card flex justify-center">
        <Password v-model="value" :feedback="false" />
    </div>
</template>
<script setup>
import { ref } from 'vue';
const value = ref(null);
</script>
```

# RadioButton

RadioButton is an extension to standard radio button element with theming.

## Import

```javascript
import RadioButton from 'primevue/radiobutton'
import RadioButtonGroup from 'primevue/radiobuttongroup'
```

## Group

RadioButton is used with the *v-model* property for two-way value binding.

```ts
<template>
    <div class="card flex justify-center">
        <div class="flex flex-wrap gap-4">
            <div class="flex items-center gap-2">
                <RadioButton v-model="ingredient" inputId="ingredient1" name="pizza" value="Cheese" />
                <label for="ingredient1">Cheese</label>
            </div>
            <div class="flex items-center gap-2">
                <RadioButton v-model="ingredient" inputId="ingredient2" name="pizza" value="Mushroom" />
                <label for="ingredient2">Mushroom</label>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';
const ingredient = ref('');
</script>
```

# Rating

Rating component is a star based selection input.

## Import

```javascript
import Rating from 'primevue/rating'
```

## Basic

Rating is used with the *v-model* property for two-way value binding.

```ts
<template>
    <div class="card flex justify-center">
        <Rating v-model="value" />
    </div>
</template>

<script setup>
import { ref } from 'vue';

const value = ref(null);
</script>
```

# Select

Select is used to choose an item from a collection of options.

## Import

```javascript
import Select from 'primevue/select'
```

## Basic

Select is used with the *v-model* property for two-way value binding along with the *options* collection. Label and value of an option are defined with the *optionLabel* and *optionValue* properties respectively. Note that, when options are simple primitive values such as a string array, no *optionLabel* and *optionValue* would be necessary.

```ts
<template>
    <div class="card flex justify-center">
        <Select v-model="selectedCity" :options="cities" optionLabel="name" placeholder="Select a City" class="w-full md:w-56" />
    </div>
</template>

<script setup>
import { ref } from "vue";
const selectedCity = ref();
const cities = ref([
    { name: 'New York', code: 'NY' },
    { name: 'Paris', code: 'PRS' }
]);
</script>
```

# SelectButton

SelectButton is used to choose single or multiple items from a list using buttons.

## Import

```javascript
import SelectButton from 'primevue/selectbutton'
```

## Basic

SelectButton is used with the *v-model* property for two-way value binding along with the *options* collection. Label and value of an option are defined with the *optionLabel* and *optionValue* properties respectively. Note that, when options are simple primitive values such as a string array, no *optionLabel* and *optionValue* would be necessary.

```ts
<template>
    <div class="card flex justify-center">
        <SelectButton v-model="value" :options="options" />
    </div>
</template>

<script setup>
import { ref } from 'vue';

const value = ref('One-Way');
const options = ref(['One-Way', 'Return']);
</script>
```

# Slider

Slider is a component to provide input with a drag handle.

## Import

```javascript
import Slider from 'primevue/slider'
```

## Basic

Slider is used with the *v-model* property for two-way value binding.

```ts
<template>
    <div class="card flex justify-center">
        <Slider v-model="value" class="w-56" />
    </div>
</template>
<script setup>
import { ref } from 'vue';
const value = ref(null);
</script>
```

# Textarea

Textarea adds styling and autoResize functionality to standard textarea element.

## Import

```javascript
import Textarea from 'primevue/textarea'
```

## Basic

Textarea is used with the *v-model* property for two-way value binding.

```ts
<template>
    <div class="card flex justify-center">
        <Textarea v-model="value" rows="5" cols="30" />
    </div>
</template>
<script setup>
import { ref } from 'vue';
const value = ref('');
</script>
```

# ToggleButton

ToggleButton is used to select a boolean value using a button.

## Import

```javascript
import ToggleButton from 'primevue/togglebutton'
```

## Basic

ToggleButton is used with the *v-model* property for two-way value binding.

```ts
<template>
    <div class="card flex justify-center">
        <ToggleButton v-model="checked" class="w-24" onLabel="On" offLabel="Off" />
    </div>
</template>

<script setup>
import { ref } from 'vue';
const checked = ref(false);
</script>
```

# ToggleSwitch

ToggleSwitch is used to select a boolean value.

## Import

```javascript
import ToggleSwitch from 'primevue/toggleswitch'
```

## Basic

ToggleSwitch is used with the *v-model* property for two-way value binding.

```ts
<template>
    <div class="card flex justify-center">
        <ToggleSwitch v-model="checked" />
    </div>
</template>

<script setup>
import { ref } from 'vue';
const checked = ref(false);
</script>
```

# Button

Button is an extension to standard input element with icons and theming.

## Import

```javascript
import Button from 'primevue/button'
```

## Basic

Text to display on a button is defined with the *label* property.

```ts
<template>
    <div class="card flex justify-center">
        <Button label="Submit" />
    </div>
</template>
<script setup>
</script>
```

# Speed Dial

When pressed, a floating action button can display multiple primary actions that can be performed on a page.

## Import

```javascript
import SpeedDial from 'primevue/speeddial'
```

```ts
<template>
    <div class="card">
        <div style="position: relative; height: 500px">
            <SpeedDial :model="items" direction="up" style="position: absolute; left: calc(50% - 2rem); bottom: 0" />
            <SpeedDial :model="items" direction="down" style="position: absolute; left: calc(50% - 2rem); top: 0" />
            <SpeedDial :model="items" direction="left" style="position: absolute; top: calc(50% - 2rem); right: 0" />
            <Toast />
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useRouter } from 'vue-router';

const toast = useToast();
const router = useRouter();

const items = ref([
    {
        label: 'Add',
        icon: 'pi pi-pencil',
        command: () => {
            toast.add({ severity: 'info', summary: 'Add', detail: 'Data Added', life: 3000 });
        }
    },
    {
        label: 'Delete',
        icon: 'pi pi-trash',
        command: () => {
            toast.add({ severity: 'error', summary: 'Delete', detail: 'Data Deleted', life: 3000 });
        }
    },
    {
        label: 'Upload',
        icon: 'pi pi-upload',
        command: () => {
            router.push('/fileupload');
        }
    },
    {
        label: 'Vue Website',
        icon: 'pi pi-external-link',
        command: () => {
            window.location.href = 'https://vuejs.org/'
        }
    }
])
</script>
```

# SplitButton

SplitButton groups a set of commands in an overlay with a default command.

## Import

```javascript
import SplitButton from 'primevue/splitbutton'
```

## Basic

SplitButton has a default command button and a collection of additional options defined by the *model* property.

```ts

<template>
    <div class="card flex justify-center">
        <Toast />
        <SplitButton label="Save" @click="save" :model="items" />
    </div>
</template>

<script setup>
import { useToast } from "primevue/usetoast";
const toast = useToast();

const items = [
    {
        label: 'Update',
        command: () => {
            toast.add({ severity: 'success', summary: 'Updated', detail: 'Data Updated', life: 3000 });
        }
    },
    {
        label: 'Delete',
        command: () => {
            toast.add({ severity: 'warn', summary: 'Delete', detail: 'Data Deleted', life: 3000 });
        }
    },
    {
        separator: true
    }
];

const save = () => {
    toast.add({ severity: 'success', summary: 'Success', detail: 'Data Saved', life: 3000 });
};
</script>

```

# DataTable

DataTable displays data in tabular format.

## Import

```javascript
import Column from 'primevue/column'
import ColumnGroup from 'primevue/columngroup' // optional
import DataTable from 'primevue/datatable'
import Row from 'primevue/row' // optional
```

## Basic

DataTable requires a *value* as data to display and *Column* components as children for the representation.

```ts
<template>
    <div class="card">
        <DataTable :value="products" tableStyle="min-width: 50rem">
            <Column field="code" header="Code"></Column>
            <Column field="name" header="Name"></Column>
        </DataTable>
    </div>
</template>
<script setup>
import { ref, onMounted } from 'vue';
import { ProductService } from '@/service/ProductService';
onMounted(() => {
    ProductService.getProductsMini().then((data) => (products.value = data));
});

const products = ref();
</script>
```

# OrderList

OrderList is used to sort a collection.

## Import

```javascript
import OrderList from 'primevue/orderlist'
```

## Basic

OrderList requires an array as its value bound with the *v-model* directive and *option* template for its content.

```ts

<template>
    <div class="card sm:flex sm:justify-center">
        <OrderList v-model="products" dataKey="id" breakpoint="575px" pt:pcListbox:root="w-full sm:w-56">
            <template #option="{ option }">
                {{ option.name }}
            </template>
        </OrderList>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ProductService } from '@/service/ProductService'

const products = ref(null);
onMounted(() => {
    ProductService.getProductsSmall().then((data) => (products.value = data));
});
</script>
```

# OrganizationChart

OrganizationChart visualizes hierarchical organization data.

## Import

```javascript
import OrganizationChart from 'primevue/organizationchart'
```

## Basic

OrganizationChart requires a collection of *TreeNode* instances as a ​*value*.

```ts
<template>
    <div class="card overflow-x-auto">
        <OrganizationChart :value="data">
            <template #default="slotProps">
                <span>{{ slotProps.node.label }}</span>
            </template>
        </OrganizationChart>
    </div>
</template>

<script setup>
import { ref } from "vue";

const data = ref({
    label: 'Argentina',
    children: [
        {
            label: 'Argentina',
            children: [
                {
                    label: 'Argentina'
                },
                {
                    label: 'Croatia'
                }
            ]
        },
        {
            label: 'France',
            children: [
                {
                    label: 'France'
                },
                {
                    label: 'Morocco'
                }
            ]
        }
    ]
});
</script>
```

# Paginator

Paginator displays data in paged format and provides navigation between pages.

## Import

```javascript
import Paginator from 'primevue/paginator'
```

## Basic

Paginator is used as a controlled component with *first* and *rows* properties to manage the first index and number of records to display per page. Total number of records need to be with *totalRecords* property. Default template includes a dropdown to change the *rows* so *rowsPerPageOptions* is also necessary for the dropdown options.

```ts
<template>
    <div class="card">
        <Paginator :rows="10" :totalRecords="120" :rowsPerPageOptions="[10, 20, 30]"></Paginator>
    </div>
</template>

<script setup>
</script>
```

# Timeline

Timeline visualizes a series of chained events.

## Import

```javascript
import Timeline from 'primevue/timeline'
```

## Basic

Timeline requires a *value* for the collection of events and *content* slot that receives an object as a parameter to return content.

```ts
<template>
    <div class="card">
        <Timeline :value="events">
            <template #content="slotProps">
                {{ slotProps.item.status }}
            </template>
        </Timeline>
    </div>
</template>

<script setup>
import { ref } from "vue";

const events = ref([
    { status: 'Ordered', date: '15/10/2020 10:30', icon: 'pi pi-shopping-cart', color: '#9C27B0'},
    { status: 'Processing', date: '15/10/2020 14:00', icon: 'pi pi-cog', color: '#673AB7' },
]);

</script>
```

# Tree

Tree is used to display hierarchical data.

## Import

```javascript
import Tree from 'primevue/tree'
```

## Basic

Tree component requires an array of TreeNode objects as its ​*value*.

```ts
<template>
    <div class="card">
        <Tree :value="nodes" class="w-full md:w-[30rem]"></Tree>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { NodeService } from '@/service/NodeService';

const nodes = ref(null);

onMounted(() => {
    NodeService.getTreeNodes().then((data) => (nodes.value = data));
});
</script>
```

# Accordion

Accordion groups a collection of contents in panels.

## Import

```javascript
import Accordion from 'primevue/accordion'
import AccordionContent from 'primevue/accordioncontent'
import AccordionHeader from 'primevue/accordionheader'
import AccordionPanel from 'primevue/accordionpanel'
```

## Basic

Accordion is defined using ​*AccordionPanel*​, *AccordionHeader* and *AccordionContent* components. Each AccordionPanel must contain a unique *value* property to specify the active item.

```ts
<template>
    <div class="card">
        <Accordion value="0">
            <AccordionPanel value="0">
                <AccordionHeader>Header I</AccordionHeader>
                <AccordionContent>
                    <p class="m-0">
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit
                    </p>
                </AccordionContent>
            </AccordionPanel>
            <AccordionPanel value="1">
                <AccordionHeader>Header II</AccordionHeader>
                <AccordionContent>
                    <p class="m-0">
                        Sed ut perspiciatis unde omnis iste natus error sit voluptatem
                    </p>
                </AccordionContent>
            </AccordionPanel>
            <AccordionPanel value="2">
                <AccordionHeader>Header III</AccordionHeader>
                <AccordionContent>
                    <p class="m-0">
                        At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis
                    </p>
                </AccordionContent>
            </AccordionPanel>
        </Accordion>
    </div>
</template>

<script setup>
</script>
```

# Card

Card is a flexible container component.

## Import

```javascript

import Card from 'primevue/card'
```

## Basic

A simple Card is created with a *title* property along with the content as children.

```ts

<template>
    <Card>
        <template #title>Simple Card</template>
        <template #content>
            <p class="m-0">
                Lorem ipsum dolor sit amet, consectetur adipisicing elit.
                quas!
            </p>
        </template>
    </Card>
</template>

<script setup>
</script>

```

# Fieldset

Fieldset is a grouping component with a content toggle feature.

## Import

```javascript

import Fieldset from 'primevue/fieldset'

```

## Basic

A simple Fieldset is created with a *legend* property along with the content as children.

```ts
<template>
    <div class="card">
        <Fieldset legend="Header">
            <p class="m-0">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam
            </p>
        </Fieldset>
    </div>
</template>
<script setup>
</script>
```

# Panel

Panel is a grouping component providing with content toggle feature.

## Import

```javascript
import Panel from 'primevue/panel'
```

## Basic

A simple Panel is created with a *header* property along with the content as children.

```ts

<template>
    <div class="card">
        <Panel header="Header">
            <p class="m-0">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
            </p>
        </Panel>
    </div>
</template>

<script setup>
</script>
```

# ScrollPanel

ScrollPanel is a cross browser, lightweight and skinnable alternative to native browser scrollbar.

## Import

```javascript
import ScrollPanel from 'primevue/scrollpanel'
```

## Basic

ScrollPanel is defined using dimensions for the scrollable viewport.

```ts
<template>
    <div class="card">
        <ScrollPanel style="width: 100%; height: 200px">
            <p>
                Lorem ipsum dolor sit amet, consectetur
            </p>
            <p>
                Sed ut perspiciatis unde omnis iste natus error
            </p>
            <p>
                At vero eos et accusamus et iusto odio dignissimos
            </p>
            <p class="m-0">
                Quod maxime placeat facere possimus, omnis voluptas
            </p>
        </ScrollPanel>
    </div>
</template>
```

# Splitter

Splitter is utilized to separate and resize panels.

## Import

```javascript
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
```

## Horizontal

Splitter requires two SplitterPanel components as children which are displayed horizontally by default.

```ts
<template>
    <div class="card">
        <Splitter style="height: 300px">
            <SplitterPanel class="flex items-center justify-center"> Panel 1 </SplitterPanel>
            <SplitterPanel class="flex items-center justify-center"> Panel 2 </SplitterPanel>
        </Splitter>
    </div>
</template>
```

# Stepper

The Stepper component displays a wizard-like workflow by guiding users through the multi-step progression.

## Import

```javascript
import Step from 'primevue/step'
import StepItem from 'primevue/stepitem'
import StepList from 'primevue/steplist'
import StepPanel from 'primevue/steppanel'
import StepPanels from 'primevue/steppanels'
import Stepper from 'primevue/stepper'
```

## Horizontal

Stepper consists of a combination of ​*StepList*​, ​*Step*​, *StepPanels* and *StepPanel* components. The *value* property is essential for associating Step and StepPanel with each other.

```ts
<template>
    <div class="card flex justify-center">
        <Stepper value="1" class="basis-[50rem]">
            <StepList>
                <Step value="1">Header I</Step>
                <Step value="2">Header II</Step>
                <Step value="3">Header III</Step>
            </StepList>
            <StepPanels>
                <StepPanel v-slot="{ activateCallback }" value="1">
                    <div class="flex flex-col h-48">
                        <div class="border-2 border-dashed border-surface-200 dark:border-surface-700 rounded bg-surface-50 dark:bg-surface-950 flex-auto flex justify-center items-center font-medium">Content I</div>
                    </div>
                    <div class="flex pt-6 justify-end">
                        <Button label="Next" icon="pi pi-arrow-right" iconPos="right" @click="activateCallback('2')" />
                    </div>
                </StepPanel>
                <StepPanel v-slot="{ activateCallback }" value="2">
                    <div class="flex flex-col h-48">
                        <div class="border-2 border-dashed border-surface-200 dark:border-surface-700 rounded bg-surface-50 dark:bg-surface-950 flex-auto flex justify-center items-center font-medium">Content II</div>
                    </div>
                    <div class="flex pt-6 justify-between">
                        <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('1')" />
                        <Button label="Next" icon="pi pi-arrow-right" iconPos="right" @click="activateCallback('3')" />
                    </div>
                </StepPanel>
                <StepPanel v-slot="{ activateCallback }" value="3">
                    <div class="flex flex-col h-48">
                        <div class="border-2 border-dashed border-surface-200 dark:border-surface-700 rounded bg-surface-50 dark:bg-surface-950 flex-auto flex justify-center items-center font-medium">Content III</div>
                    </div>
                    <div class="pt-6">
                        <Button label="Back" severity="secondary" icon="pi pi-arrow-left" @click="activateCallback('2')" />
                    </div>
                </StepPanel>
            </StepPanels>
        </Stepper>
    </div>
</template>
```

# Tabs

Tabs facilitates seamless switching between different views.

## Import

```javascript
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
```

## Basic

Tabs is defined using ​*TabList*​, ​*Tab*​, *TabPanels* and *TabPanel* components. Tab and TabPanel components are associated with their *value* properties.

```ts
<template>
    <div class="card">
        <Tabs value="0">
            <TabList>
                <Tab value="0">Header I</Tab>
                <Tab value="1">Header II</Tab>
                <Tab value="2">Header III</Tab>
            </TabList>
            <TabPanels>
                <TabPanel value="0">
                    <p class="m-0">
                        Lorem ipsum
                    </p>
                </TabPanel>
                <TabPanel value="1">
                    <p class="m-0">
                        Sed ut perspiciatis unde omnis iste
                    </p>
                </TabPanel>
                <TabPanel value="2">
                    <p class="m-0">
                        At vero eos et accusamus et iusto odio dignissimos ducimus
                    </p>
                </TabPanel>
            </TabPanels>
        </Tabs>
    </div>
</template>

<script setup>
</script>
```

# Toolbar

Toolbar is a grouping component for buttons and other content.

## Import

```javascript
import Toolbar from 'primevue/toolbar'
```

## Basic

Toolbar provides ​*start*​, *center* and *end* properties to place content at these sections.

```ts
<template>
    <div class="card">
        <Toolbar>
            <template #start>
                <Button icon="pi pi-plus" class="mr-2" severity="secondary" text />
                <Button icon="pi pi-print" class="mr-2" severity="secondary" text />
                <Button icon="pi pi-upload" severity="secondary" text />
            </template>

            <template #center>
                <IconField>
                    <InputIcon>
                        <i class="pi pi-search" />
                    </InputIcon>
                    <InputText placeholder="Search" />
                </IconField>
            </template>

            <template #end> <SplitButton label="Save" :model="items"></SplitButton></template>
        </Toolbar>
    </div>
</template>

<script setup>
import { ref } from 'vue';

const items = ref([
    {
        label: 'Update',
        icon: 'pi pi-refresh'
    },
    {
        label: 'Delete',
        icon: 'pi pi-times'
    }
])
</script>
```

# ConfirmDialog

ConfirmDialog uses a Dialog UI that is integrated with the Confirmation API.

## Import

```javascript
import ConfirmDialog from 'primevue/confirmdialog'
```

## Service

ConfirmDialog is controlled via the *ConfirmationService* that needs to be installed as an application plugin.

```javascript
import ConfirmationService from 'primevue/confirmationservice'
import { createApp } from 'vue'

const app = createApp(App)
app.use(ConfirmationService)
```

The service is available with the *useConfirm* function for Composition API or using the  *$confirm* property of the application for Options API.

```javascript
import { useConfirm } from "primevue/useconfirm"

const confirm = useConfirm()
```

## Basic

ConfirmDialog is displayed by calling the *require* method of the  *$confirm* instance by passing the options to customize the Dialog. The *target* attribute is mandatory to align the popup to its referrer.

```ts
<template>
    <Toast />
    <ConfirmDialog></ConfirmDialog>
    <div class="card flex flex-wrap gap-2 justify-center">
        <Button @click="confirm1()" label="Save" variant="outlined"></Button>
        <Button @click="confirm2()" label="Delete" severity="danger" variant="outlined"></Button>
    </div>
</template>

<script setup>
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";

const confirm = useConfirm();
const toast = useToast();

const confirm1 = () => {
    confirm.require({
        message: 'Are you sure you want to proceed?',
        header: 'Confirmation',
        icon: 'pi pi-exclamation-triangle',
        rejectProps: {
            label: 'Cancel',
            severity: 'secondary',
            outlined: true
        },
        acceptProps: {
            label: 'Save'
        },
        accept: () => {
            toast.add({ severity: 'info', summary: 'Confirmed', detail: 'You have accepted', life: 3000 });
        },
        reject: () => {
            toast.add({ severity: 'error', summary: 'Rejected', detail: 'You have rejected', life: 3000 });
        }
    });
};

const confirm2 = () => {
    confirm.require({
        message: 'Do you want to delete this record?',
        header: 'Danger Zone',
        icon: 'pi pi-info-circle',
        rejectLabel: 'Cancel',
        rejectProps: {
            label: 'Cancel',
            severity: 'secondary',
            outlined: true
        },
        acceptProps: {
            label: 'Delete',
            severity: 'danger'
        },
        accept: () => {
            toast.add({ severity: 'info', summary: 'Confirmed', detail: 'Record deleted', life: 3000 });
        },
        reject: () => {
            toast.add({ severity: 'error', summary: 'Rejected', detail: 'You have rejected', life: 3000 });
        }
    });
};
</script>
```

# Dialog

Dialog is a container to display content in an overlay window.

## Import

```javascript
import Dialog from 'primevue/dialog'
```

## Basic

Dialog is used as a container and visibility is controlled with a binding to *visible* property.

```ts

<template>
    <div class="card flex justify-center">
        <Button label="Show" @click="visible = true" />
        <Dialog v-model:visible="visible" modal header="Edit Profile" :style="{ width: '25rem' }">
            <span class="text-surface-500 dark:text-surface-400 block mb-8">Update your information.</span>
            <div class="flex items-center gap-4 mb-4">
                <label for="username" class="font-semibold w-24">Username</label>
                <InputText id="username" class="flex-auto" autocomplete="off" />
            </div>
            <div class="flex items-center gap-4 mb-8">
                <label for="email" class="font-semibold w-24">Email</label>
                <InputText id="email" class="flex-auto" autocomplete="off" />
            </div>
            <div class="flex justify-end gap-2">
                <Button type="button" label="Cancel" severity="secondary" @click="visible = false"></Button>
                <Button type="button" label="Save" @click="visible = false"></Button>
            </div>
        </Dialog>
    </div>
</template>

<script setup>
import { ref } from "vue";

const visible = ref(false);
</script>
```

# Popover

Popover is a container component that can overlay other components on page.

## Import

```javascript
import Popover from 'primevue/popover'
```

## Basic

Popover is accessed via its ref and visibility is controlled using ​*toggle*​, *show* and *hide* functions with an event of the target.

```ts

<template>
    <div class="card flex justify-center">
        <Button type="button" icon="pi pi-share-alt" label="Share" @click="toggle" />

        <Popover ref="op">
            <div class="flex flex-col gap-4 w-[25rem]">
                <div>
                    <span class="font-medium block mb-2">Share this document</span>
                    <InputGroup>
                        <InputText value="https://primevue.org/12323ff26t2g243g423g234gg52hy25XADXAG3" readonly class="w-[25rem]"></InputText>
                        <InputGroupAddon>
                            <i class="pi pi-copy"></i>
                        </InputGroupAddon>
                    </InputGroup>
                </div>
                <div>
                    <span class="font-medium block mb-2">Invite Member</span>
                    <InputGroup>
                        <InputText disabled />
                        <Button label="Invite" icon="pi pi-users"></Button>
                    </InputGroup>
                </div>
                <div>
                    <span class="font-medium block mb-2">Team Members</span>
                    <ul class="list-none p-0 m-0 flex flex-col gap-4">
                        <li v-for="member in members" :key="member.name" class="flex items-center gap-2">
                            <img :src="`https://primefaces.org/cdn/primevue/images/avatar/${member.image}`" style="width: 32px" />
                            <div>
                                <span class="font-medium">{{ member.name }}</span>
                                <div class="text-sm text-surface-500 dark:text-surface-400">{{ member.email }}</div>
                            </div>
                            <div class="flex items-center gap-2 text-surface-500 dark:text-surface-400 ml-auto text-sm">
                                <span>{{ member.role }}</span>
                                <i class="pi pi-angle-down"></i>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>
        </Popover>
    </div>
</template>

<script setup>
import { ref } from "vue";

const op = ref();
const members = ref([
    { name: 'Amy Elsner', image: 'amyelsner.png', email: 'amy@email.com', role: 'Owner' },
    { name: 'Bernardo Dominic', image: 'bernardodominic.png', email: 'bernardo@email.com', role: 'Editor' },
    { name: 'Ioni Bowcher', image: 'ionibowcher.png', email: 'ioni@email.com', role: 'Viewer' }
]);

const toggle = (event) => {
    op.value.toggle(event);
}
</script>
```

# File Upload

FileUpload is an advanced uploader with dragdrop support, multi file uploads, auto uploading, progress tracking and validations.

## Import

```javascript

import FileUpload from 'primevue/fileupload'

```

## Basic

FileUpload basic *mode* provides a simpler UI as an alternative to default advanced mode.

```ts

<template>
    <Toast />
    <div class="card flex flex-wrap gap-6 items-center justify-between">
        <FileUpload ref="fileupload" mode="basic" name="demo[]" url="/api/upload" accept="image/*" :maxFileSize="1000000" @upload="onUpload" />
        <Button label="Upload" @click="upload" severity="secondary" />
    </div>
</template>

<script setup>
import { ref } from 'vue';
import { useToast } from "primevue/usetoast";
const toast = useToast();
const fileupload = ref();

const upload = () => {
    fileupload.value.upload();
};

const onUpload = () => {
    toast.add({ severity: 'info', summary: 'Success', detail: 'File Uploaded', life: 3000 });
};
</script>
```

# Dock

Dock is a navigation component consisting of menuitems.

## Import

```javascript

import Dock from 'primevue/dock'

```

## Basic

Dock requires a collection of menuitems as its *model* and an *icon* template. Default location is *bottom* and other edges are also available when defined with the *position* property.

```ts

<template>
    <div class="card dock-demo">
        <div class="flex flex-wrap gap-4 mb-8">
            <div v-for="pos of positions" :key="pos.label" class="flex items-center">
                <RadioButton v-model="position" :value="pos.value" :inputId="pos.label" name="dock" />
                <label :for="pos.label" class="ml-2"> {{ pos.label }} </label>
            </div>
        </div>
        <div class="dock-window" style="backgroundimage: 'url(https://primefaces.org/cdn/primevue/images/dock/window.jpg))'">
            <Dock :model="items" :position="position">
                <template #itemicon="{ item }">
                    <img v-tooltip.top="item.label" :alt="item.label" :src="item.icon" style="width: 100%" />
                </template>
            </Dock>
        </div>
    </div>
</template>

<script setup>
import { ref } from "vue";

const items = ref([
    {
        label: 'Finder',
        icon: 'https://primefaces.org/cdn/primevue/images/dock/finder.svg'
    },
    {
        label: 'Trash',
        icon: 'https://primefaces.org/cdn/primevue/images/dock/trash.png'
    }
]);
const position = ref('bottom');
const positions = ref([
    {
        label: 'Bottom',
        value: 'bottom'
    },
    {
        label: 'Top',
        value: 'top'
    },
    {
        label: 'Left',
        value: 'left'
    },
    {
        label: 'Right',
        value: 'right'
    }
]);

</script>
<style scoped>
.dock-demo > .dock-window {
    width: 100%;
    height: 450px;
    position: relative;
    background-image: url("https://primefaces.org/cdn/primevue/images/dock/window.jpg");
    background-repeat: no-repeat;
    background-size: cover;
    z-index: 1;
}

.dock-demo > .p-dock {
    z-index: 1000;
}
</style>
```

# Menu

Menu displays a list of items in vertical orientation.

## Import

```javascript
import Menu from 'primevue/menu'
```

## Basic

Menu requires a collection of menuitems as its ​*model*.

```ts
<template>
    <div class="card flex justify-center">
        <Menu :model="items" />
    </div>
</template>

<script setup>
import { ref } from "vue";

const items = ref([
    { label: 'New', icon: 'pi pi-plus' },
    { label: 'Search', icon: 'pi pi-search' }
]);
</script>
```

# Menubar

Menubar also known as Navbar, is a horizontal menu component.

## Import

```javascript
import Menubar from 'primevue/menubar'
```

## Basic

Menubar requires a collection of menuitems as its ​*model*.

```ts
<template>
    <div class="card">
        <Menubar :model="items" />
    </div>
</template>

<script setup>
import { ref } from "vue";

const items = ref([
    {
        label: 'Home',
        icon: 'pi pi-home'
    },
    {
        label: 'Projects',
        icon: 'pi pi-search',
        items: [
            {
                label: 'Components',
                icon: 'pi pi-bolt'
            },
            {
                label: 'UI Kit',
                icon: 'pi pi-pencil'
            },
            {
                label: 'Templates',
                icon: 'pi pi-palette',
                items: [
                    {
                        label: 'Apollo',
                        icon: 'pi pi-palette'
                    },
                    {
                        label: 'Ultima',
                        icon: 'pi pi-palette'
                    }
                ]
            }
        ]
    },
    {
        label: 'Contact',
        icon: 'pi pi-envelope'
    }
]);
</script>

```

# MegaMenu

MegaMenu is a navigation component that displays submenus and content in columns.

## Import

```javascript
import MegaMenu from 'primevue/megamenu'
```

## Basic

MegaMenu requires a collection of menuitems as its ​*model*.

```ts
<template>
    <div class="card">
        <MegaMenu :model="items" />
    </div>
</template>

<script setup>
import { ref } from "vue";

const items = ref([
    {
        label: 'Furniture',
        icon: 'pi pi-box',
        items: [
            [
                {
                    label: 'Living Room',
                    items: [{ label: 'Accessories' }, { label: 'Armchair' }, { label: 'Coffee Table' }, { label: 'Couch' }, { label: 'TV Stand' }]
                }
            ],
            [
                {
                    label: 'Kitchen',
                    items: [{ label: 'Bar stool' }, { label: 'Chair' }, { label: 'Table' }]
                },
                {
                    label: 'Bathroom',
                    items: [{ label: 'Accessories' }]
                }
            ],
            [
                {
                    label: 'Bedroom',
                    items: [{ label: 'Bed' }, { label: 'Chaise lounge' }, { label: 'Cupboard' }, { label: 'Dresser' }, { label: 'Wardrobe' }]
                }
            ],
            [
                {
                    label: 'Office',
                    items: [{ label: 'Bookcase' }, { label: 'Cabinet' }, { label: 'Chair' }, { label: 'Desk' }, { label: 'Executive Chair' }]
                }
            ]
        ]
    },
    {
        label: 'Electronics',
        icon: 'pi pi-mobile',
        items: [
            [
                {
                    label: 'Computer',
                    items: [{ label: 'Monitor' }, { label: 'Mouse' }, { label: 'Notebook' }, { label: 'Keyboard' }, { label: 'Printer' }, { label: 'Storage' }]
                }
            ],
            [
                {
                    label: 'Home Theater',
                    items: [{ label: 'Projector' }, { label: 'Speakers' }, { label: 'TVs' }]
                }
            ],
            [
                {
                    label: 'Gaming',
                    items: [{ label: 'Accessories' }, { label: 'Console' }, { label: 'PC' }, { label: 'Video Games' }]
                }
            ],
            [
                {
                    label: 'Appliances',
                    items: [{ label: 'Coffee Machine' }, { label: 'Fridge' }, { label: 'Oven' }, { label: 'Vaccum Cleaner' }, { label: 'Washing Machine' }]
                }
            ]
        ]
    },
    {
        label: 'Sports',
        icon: 'pi pi-clock',
        items: [
            [
                {
                    label: 'Football',
                    items: [{ label: 'Kits' }, { label: 'Shoes' }, { label: 'Shorts' }, { label: 'Training' }]
                }
            ],
            [
                {
                    label: 'Running',
                    items: [{ label: 'Accessories' }, { label: 'Shoes' }, { label: 'T-Shirts' }, { label: 'Shorts' }]
                }
            ],
            [
                {
                    label: 'Swimming',
                    items: [{ label: 'Kickboard' }, { label: 'Nose Clip' }, { label: 'Swimsuits' }, { label: 'Paddles' }]
                }
            ],
            [
                {
                    label: 'Tennis',
                    items: [{ label: 'Balls' }, { label: 'Rackets' }, { label: 'Shoes' }, { label: 'Training' }]
                }
            ]
        ]
    }
]);
</script>

```

# Chart

Chart components are based on Chart.js, an open source HTML5 based charting library.

## Import

```javascript

import Chart from 'primevue/chart'

```

## Chart.js

Chart component uses [Chart.JS](https://chartjs.org/) underneath so it needs to be installed as a dependency.

```javascript
npm install chart.js
```

## Basic

A chart is configured with 3 properties; ​*type*​, *data* and ​*options*​. Chart type is defined using the *type* property that accepts ​*pie*​, ​*doughnut*​, ​*line*​, ​*bar*​, *radar* and *polarArea* as a value. The *data* defines datasets represented with the chart and the *options* provide numerous customization options to customize the presentation.

```ts

<template>
    <div class="card">
        <Chart type="bar" :data="chartData" :options="chartOptions" />
    </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

onMounted(() => {
    chartData.value = setChartData();
    chartOptions.value = setChartOptions();
});

const chartData = ref();
const chartOptions = ref();

const setChartData = () => {
    return {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        datasets: [
            {
                label: 'Sales',
                data: [540, 325, 702, 620],
                backgroundColor: ['rgba(249, 115, 22, 0.2)', 'rgba(6, 182, 212, 0.2)', 'rgb(107, 114, 128, 0.2)', 'rgba(139, 92, 246 0.2)'],
                borderColor: ['rgb(249, 115, 22)', 'rgb(6, 182, 212)', 'rgb(107, 114, 128)', 'rgb(139, 92, 246)'],
                borderWidth: 1
            }
        ]
    };
};
const setChartOptions = () => {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--p-text-color');
    const textColorSecondary = documentStyle.getPropertyValue('--p-text-muted-color');
    const surfaceBorder = documentStyle.getPropertyValue('--p-content-border-color');

    return {
        plugins: {
            legend: {
                labels: {
                    color: textColor
                }
            }
        },
        scales: {
            x: {
                ticks: {
                    color: textColorSecondary
                },
                grid: {
                    color: surfaceBorder
                }
            },
            y: {
                beginAtZero: true,
                ticks: {
                    color: textColorSecondary
                },
                grid: {
                    color: surfaceBorder
                }
            }
        }
    };
}
</script>

```

# Message

Message component is used to display inline messages.

## Import

```javascript

import Message from 'primevue/message'

```

## Basic

Message component requires a content to display.

```ts

<template>
    <div class="card">
        <Message>Message Content</Message>
    </div>
</template>

<script setup>
</script>

```

# Toast

Toast is used to display messages in an overlay.

## Import

```javascript

import Toast from 'primevue/toast'

```

## Toast Service

Toast component is controlled via the *ToastService* that needs to be installed as an application plugin.

```javascript

import ToastService from 'primevue/toastservice'
import { createApp } from 'vue'

const app = createApp(App)
app.use(ToastService)

```

The service is available with the *useToast* function for Composition API or using the  *$toast* property of the application for Options API.

```javascript

import { useToast } from 'primevue/usetoast'

const toast = useToast()

```

## Basic[#](https://primevue.org/toast/#basic)

Ideal location of a Toast is the main application template so that it can be used by any component within the application. A single message is represented by the Message interface that defines properties such as severity, summary and detail.

```ts

<template>
    <div class="card flex justify-center">
        <Toast />
        <Button label="Show" @click="show()" />
    </div>
</template>

<script setup>
import { useToast } from "primevue/usetoast";
const toast = useToast();

const show = () => {
    toast.add({ severity: 'info', summary: 'Info', detail: 'Message Content', life: 3000 });
};
</script>

```

# Carousel

Carousel is a content slider featuring various customization options.

## Import

```javascript

import Carousel from 'primevue/carousel'

```

## Basic

Carousel requires a collection of items as its value along with a template to render each item.

```ts

<template>
    <div class="card">
        <Carousel :value="products" :numVisible="3" :numScroll="3" :responsiveOptions="responsiveOptions">
            <template #item="slotProps">
                <div class="border border-surface-200 dark:border-surface-700 rounded m-2  p-4">
                    <div class="mb-4">
                        <div class="relative mx-auto">
                            <img :src="'https://primefaces.org/cdn/primevue/images/product/' + slotProps.data.image" :alt="slotProps.data.name" class="w-full rounded" />
                            <Tag :value="slotProps.data.inventoryStatus" :severity="getSeverity(slotProps.data.inventoryStatus)" class="absolute" style="left:5px; top: 5px"/>
                        </div>
                    </div>
                    <div class="mb-4 font-medium">{{ slotProps.data.name }}</div>
                    <div class="flex justify-between items-center">
                        <div class="mt-0 font-semibold text-xl">${{ slotProps.data.price }}</div>
                        <span>
                            <Button icon="pi pi-heart" severity="secondary" variant="outlined" />
                            <Button icon="pi pi-shopping-cart" class="ml-2"/>
                        </span>
                    </div>
                </div>
            </template>
        </Carousel>
    </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { ProductService } from '@/service/ProductService';

onMounted(() => {
    ProductService.getProductsSmall().then((data) => (products.value = data.slice(0, 9)));
})

const products = ref();
const responsiveOptions = ref([
    {
        breakpoint: '1400px',
        numVisible: 2,
        numScroll: 1
    },
    {
        breakpoint: '1199px',
        numVisible: 3,
        numScroll: 1
    },
    {
        breakpoint: '767px',
        numVisible: 2,
        numScroll: 1
    },
    {
        breakpoint: '575px',
        numVisible: 1,
        numScroll: 1
    }
]);

const getSeverity = (status) => {
    switch (status) {
        case 'INSTOCK':
            return 'success';

        case 'LOWSTOCK':
            return 'warn';

        case 'OUTOFSTOCK':
            return 'danger';

        default:
            return null;
    }
};

</script>

```

# Avatar

Avatar represents people using icons, labels and images.

## Import

```javascript

import Avatar from 'primevue/avatar'
import AvatarGroup from 'primevue/avatargroup' // Optional for grouping

```

## Label

A letter Avatar is defined with the *label* property.

```ts

<template>
    <div class="flex flex-wrap gap-8">
        <div class="flex-auto">
            <h5>Label</h5>
            <Avatar label="P" class="mr-2" size="xlarge" />
            <Avatar label="V" class="mr-2" size="large" style="background-color: #ece9fc; color: #2a1261" />
            <Avatar label="U" class="mr-2" style="background-color: #dee9fc; color: #1a2551" />
        </div>

        <div class="flex-auto">
            <h5>Circle</h5>
            <Avatar label="P" class="mr-2" size="xlarge" shape="circle" />
            <Avatar label="V" class="mr-2" size="large" style="background-color: #ece9fc; color: #2a1261" shape="circle" />
            <Avatar label="U" class="mr-2" style="background-color: #dee9fc; color: #1a2551" shape="circle" />
        </div>

        <div class="flex-auto">
            <h5>Badge</h5>
            <OverlayBadge value="4" severity="danger" class="inline-flex">
                <Avatar label="U" size="xlarge" />
            </OverlayBadge>
        </div>
    </div>
</template>

<script setup>

</script>

```

# Badge

Badge is a small status indicator for another element.

## Import

```javascript

// import as component
import Badge from 'primevue/badge'
import OverlayBadge from 'primevue/overlaybadge'

```

## Basic

Content to display is defined with the *value* property or the default slot.

```ts

<template>
    <div class="card flex justify-center gap-2">
        <Badge value="2"></Badge>
        <Badge>10</Badge>
    </div>
</template>

<script setup>

</script>

```

# Chip

Chip represents entities using icons, labels and images.

## Import

```javascript

import Chip from 'primevue/chip'

```

## Basic

A basic chip with a text is created with the *label* property. In addition when *removable* is added, a delete icon is displayed to remove a chip.

```ts

<template>
    <div class="card flex flex-wrap gap-2">
        <Chip label="Action" />
        <Chip label="Comedy" />
        <Chip label="Mystery" />
        <Chip label="Thriller" removable />
    </div>
</template>

<script setup>

</script>

```

# MeterGroup

MeterGroup displays scalar measurements within a known range.

## Import

```javascript

import MeterGroup from 'primevue/metergroup'

```

## Basic

MeterGroup requires a *value* as the data to display where each item in the collection should be a type of ​*MeterItem*.

```ts

<template>
    <div class="card">
        <MeterGroup :value="value" />
    </div>
</template>

<script setup>
import { ref } from "vue";

const value = ref([{ label: 'Space used', value: 15, color: 'var(--p-primary-color)' }]);
</script>

```

# ProgressBar

ProgressBar is a process status indicator.

## Import

```javascript

import ProgressBar from 'primevue/progressbar'

```

## Basic

ProgressBar is used with the *value* property.

```ts

<template>
    <div class="card">
        <ProgressBar :value="50"></ProgressBar>
    </div>
</template>

<script setup>

</script>

```

# Tag

Tag component is used to categorize content.

## Import

```javascript

import Tag from 'primevue/tag'

```

## Basic

Label of the tag is defined with the *value* property.

```ts

<template>
    <div class="card flex justify-center">
        <Tag value="New"></Tag>
    </div>
</template>

<script setup>

</script>

```

# Terminal

Terminal is a text based user interface.

## Import

```javascript

import Terminal from 'primevue/terminal'
import TerminalService from 'primevue/terminalservice'

```

## Basic

Commands are processed using an EventBus implementation called ​*TerminalService*​. Import this service into your component and subscribe to the *command* event to process the commands by sending replies with the *response* event.

```ts

<template>
    <div>
        <p>Enter "date" to display the current date, "greet {0}" for a message and "random" to get a random number.</p>
        <Terminal
            welcomeMessage="Welcome to PrimeVue"
            prompt="primevue $"
            aria-label="PrimeVue Terminal Service"
        />
    </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import TerminalService from "primevue/terminalservice";

onMounted(() => {
    TerminalService.on('command', commandHandler);
})

onBeforeUnmount(() => {
    TerminalService.off('command', commandHandler);
})

const commandHandler = (text) => {
    let response;
    let argsIndex = text.indexOf(' ');
    let command = argsIndex !== -1 ? text.substring(0, argsIndex) : text;

    switch(command) {
        case "date":
            response = 'Today is ' + new Date().toDateString();
            break;

        case "greet":
            response = 'Hola ' + text.substring(argsIndex + 1);
            break;

        case "random":
            response = Math.floor(Math.random() * 100);
            break;

        default:
            response = "Unknown command: " + command;
    }

    TerminalService.emit('response', response);
}
</script>
```

‍
