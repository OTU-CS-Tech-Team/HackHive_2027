import { z } from 'zod';

// Total across every item in one request.
export const MAX_ITEMS = 5;

// Requests one hacker can have waiting in the queue at once. The database enforces
// it too, in supabase/migrations/20261021000000_item_requests.sql.
export const MAX_PENDING_REQUESTS = 3;

// What hackers can pick under "Hardware": the MLH hardware lab
// (https://guide.mlh.com/organizer-resources/hardware-lab-contents), grouped the same
// way. One of each per hacker: a hardware item can't be asked for twice, in one
// request or across their waiting ones.
export const HARDWARE_GROUPS: { name: string; items: string[] }[] = [
  {
    name: "Kits & devices",
    items: ["Raspberry Pi 4B Kit", "Arduino and Base Shield", "Logitech Webcam", "Google Nest Mini", "JBL Go 3 Speaker"],
  },
  {
    name: "Components",
    items: [
      "Grove Buzzer",
      "Grove Touch Sensor",
      "Grove LED Socket Kit",
      "Grove Temperature and Barometer Sensor",
      "Grove Button",
      "Grove Rotary Angle Sensor",
      "Grove Sound Sensor",
      "Grove 3 Axis Digital Accelerometer",
      "Grove Light Sensor",
      "Grove I2C Color Sensor",
      "Grove LCD Screen",
      "Grove Stepper Motor",
      "Grove Ultrasonic Distance Sensor",
      "Grove Cables",
      "Grove Moisture Sensor",
      "Grove Motor/Servo Driver Board",
      "Grove Air Quality Sensor",
      "Grove Micro Switch",
      "Grove Thumb Joystick",
      "Grove UV Sensor",
      "Grove NFC/RFID Tag Board",
      "Grove Infrared Reflective Sensor",
      "Grove 7 Segment Alphanumeric Display",
      "Grove Stepper and Driver",
      "Grove Servo",
      "Brushless DC Motor",
      "Jumper wires (F/F)",
      "Jumper wires (M/F)",
      "Jumper wires (M/M)",
      "Ceramic Capacitors",
      "Resistor Kit",
      "Breadboard",
    ],
  },
  {
    name: "Tools",
    items: ["Wire Stripper", "Wire Cutter", "Curved Tweezers", "Pointed Tweezers", "Multimeter", "Needle Nose Pliers"],
  },
];

// Each item's photo, taken from the same MLH page and saved small under
// public/Images/hardware, named after the item: "Grove LCD Screen" is
// grove-lcd-screen.webp. A new item needs a photo saved under its name.
export const hardwareImage = (name: string) =>
  `/Images/hardware/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.webp`;

const HARDWARE_NAMES = new Set(HARDWARE_GROUPS.flatMap((group) => group.items));

const itemSchema = z.object({
  category: z.enum(['hardware', 'toiletries', 'other']),
  name: z.string().trim().min(1).max(100),
  quantity: z.number().int().min(1).max(MAX_ITEMS),
});

export const itemRequestSchema = z.object({
  items: z
    .array(itemSchema)
    .min(1, 'Pick at least one item.')
    .refine((items) => items.reduce((sum, item) => sum + item.quantity, 0) <= MAX_ITEMS, {
      message: `You can request up to ${MAX_ITEMS} items in total.`,
    })
    .refine((items) => items.every((item) => item.category !== 'hardware' || HARDWARE_NAMES.has(item.name)), {
      message: 'Pick hardware from the list, or add it under "Other".',
    })
    .refine(
      (items) => {
        const hardware = items.filter((item) => item.category === 'hardware');
        return hardware.every((item) => item.quantity === 1) && new Set(hardware.map((item) => item.name)).size === hardware.length;
      },
      { message: 'You can request one of each hardware item.' },
    ),
  // One name per line in the form.
  teamMembers: z
    .string()
    .max(1000)
    .transform((text) => text.split('\n').map((name) => name.trim()).filter(Boolean))
    .pipe(z.array(z.string().max(100)).max(10, 'List up to 10 team members.')),
  details: z
    .string()
    .trim()
    .max(1000, 'Keep the extra details under 1000 characters.')
    .transform((text) => text || null),
});

export type ItemRequestInput = z.input<typeof itemRequestSchema>;
