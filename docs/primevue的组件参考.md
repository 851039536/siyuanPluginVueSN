# Message

Message component is used to display inline messages.

## Import

```javascript

import Message from 'primevue/message';

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

import Toast from 'primevue/toast';

```

## Toast Service

Toast component is controlled via the *ToastService* that needs to be installed as an application plugin.

```javascript

import {createApp} from 'vue';
import ToastService from 'primevue/toastservice';

const app = createApp(App);
app.use(ToastService);

```

The service is available with the *useToast* function for Composition API or using the  *$toast* property of the application for Options API.

```javascript

import { useToast } from 'primevue/usetoast';

const toast = useToast();

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

import Carousel from 'primevue/carousel';

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

import Avatar from 'primevue/avatar';
import AvatarGroup from 'primevue/avatargroup';   //Optional for grouping

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
import Badge from 'primevue/badge';
import OverlayBadge from 'primevue/overlaybadge';

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

import Chip from 'primevue/chip';

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

import MeterGroup from 'primevue/metergroup';

```

## Basic

MeterGroup requires a *value* as the data to display where each item in the collection should be a type of *MeterItem*.

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

import ProgressBar from 'primevue/progressbar';

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

import Tag from 'primevue/tag';

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

import Terminal from 'primevue/terminal';
import TerminalService from 'primevue/terminalservice'

```

## Basic

Commands are processed using an EventBus implementation called *TerminalService*. Import this service into your component and subscribe to the *command* event to process the commands by sending replies with the *response* event.

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
