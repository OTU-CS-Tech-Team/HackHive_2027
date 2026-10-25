export type TeamMember = {
    Image: string;
    name: string;
    role: string;
    link: string;
    position?: string; // which part of the photo to keep when it's cropped, e.g. "right" or "70% center"
    zoom?: number; // enlarges the photo around `position`, for people who are small in their photo
}; 

export const presidents: TeamMember[] = [
    {
        Image: "/Images/Maryam.png",
        name: "Maryam",
        role: "Co-President",
        link: "https://www.linkedin.com/in/maryam-baz-mb1423/",
    },
    {
        Image: "/Images/Abdul.png",
        name: "Abdul Muqit",
        role: "Co-President",
        link: "https://www.linkedin.com/in/abdul-muqit-afzal/",
    },
];

export const vicePresidents: TeamMember[] = [
    {
        Image: "/Images/Samad.jpg",
        name: "Samad",
        role: "Vice-President",
        link: "https://www.linkedin.com/in/samadaku/",
    },
    {
        Image: "/Images/Samir.jpg",
        name: "Samir",
        role: "Vice-President",
        link: "https://www.linkedin.com/in/samir-chowdhury23/",
    },
];
export const techTeam: TeamMember[] = [
    {
        Image: "/Images/Umad.png",
        name: "Umad",
        role: "Director of Technology",
        link: "https://www.linkedin.com/in/umad-akram/",
    },
    {
        Image: "/Images/Haseeb.jpg",
        name: "Haseeb",
        role: "Technology Officer",
        link: "https://www.linkedin.com/in/haseeb-khann/",
    },
    {
        Image: "/Images/Tabish.jpg",
        name: "Tabish",
        role: "Technology Officer",
        link: "https://www.linkedin.com/in/tabish-ghouri/",
    },
    {
        Image: "/Images/Xavier.png",
        name: "Xavier",
        role: "Technology Officer",
        link: "https://www.linkedin.com/in/xavier-koch-527bb2387/",
    },
    {
        Image: "/Images/Tomi.png",
        name: "Tomi",
        role: "Technology Officer",
        link: "https://www.linkedin.com/in/olatomiwa-banjoko/",
    },
];
export const marketingTeam: TeamMember[] = [
    {
        Image: "/Images/Amna.jpg",
        name: "Amna",
        role: "Director of Marketing",
        link: "https://www.linkedin.com/in/amna--yousuf/",
    },
    {
        Image: "/Images/Amitav.jpg",
        name: "Amitav",
        role: "UI/UX Officer",
        link: "https://www.linkedin.com/in/amitav-sonawane/",
        position: "50% 22%",
    },
    {
        Image: "/Images/Hemanti.png",
        name: "Hemanti",
        role: "Marketing Coordinator",
        link: "https://www.linkedin.com/in/hemanti-badam-9b6986396/",
        position: "49% 30%",
        zoom: 1.3,
    },
    {
        Image: "/Images/Qudsia.jpg",
        name: "Qudsia",
        role: "Marketing Coordinator",
        link: "https://www.linkedin.com/in/qudsia-fawad-a38aaa339/",
        position: "51% 22%",
    },
    {
        Image: "/Images/Atifa_Baz_photo.jpg",
        name: "Atifa",
        role: "Marketing Coordinator",
        link: "",
        position: "37% 20%",
    },
];
export const operationsTeam: TeamMember[] = [
    {
        Image: "/Images/Ihsan.jpg",
        name: "Ihsan",
        role: "Director of Operations",
        link: "https://www.linkedin.com/in/mohammad-ihsan-wadid-47596b36b/",
        position: "48% 40%",
        zoom: 1.5,
    },
    {
        Image: "/Images/Aakash.png",
        name: "Aakash",
        role: "Tech Operations Officer",
        link: "https://www.linkedin.com/in/aakashharen/",
    },
    {
        Image: "/Images/Akeell.png",
        name: "Akeell",
        role: "Operations Officer",
        link: "https://www.linkedin.com/in/akeell-parameswaran/",
    },
];
export const eventsTeam: TeamMember[] = [
    {
        Image: "/Images/Aravind.png",
        name: "Aravind",
        role: "Director of Events",
        link: "https://www.linkedin.com/in/aravindnira/",
    },
    {
        Image: "/Images/Thomas.jpg",
        name: "Thomas",
        role: "Events Coordinator",
        link: "https://www.linkedin.com/in/thomas-mitchinson/",
        position: "49% 36%",
        zoom: 1.3,
    },
    {
        Image: "/Images/Haris.jpg",
        name: "Haris",
        role: "Events Coordinator",
        link: "https://www.linkedin.com/in/haris-khan-915300246/",
    },
    {
        Image: "/Images/Bach.jpg",
        name: "Bach",
        role: "Events Officer",
        link: "https://www.linkedin.com/in/bach-nguyen-vu/",
        position: "66% 32%",
    },
    {
        Image: "/Images/Zoha.jpeg",
        name: "Zoha",
        role: "Events Officer",
        link: "",
        position: "49% 22%",
    },
];
export const sponsorsTeam: TeamMember[] = [
    {
        Image: "/Images/Monty.png",
        name: "Monty",
        role: "Director of Sponsors",
        link: "https://www.linkedin.com/in/monty-abdi-94a5a8371/",
    },
    {
        Image: "/Images/Bushrat.jpg",
        name: "Bushrat",
        role: "Partnerships Officer",
        link: "https://www.linkedin.com/in/bushratzahan/",
    },
    {
        Image: "/Images/Rameen.jpg",
        name: "Rameen",
        role: "Partnerships Officer",
        link: "",
    },
];
export const advisors: TeamMember[] = [
    {
        Image: "/Images/Yousaf.jpg",
        name: "Yousaf",
        role: "Executive Advisor",
        link: "https://www.linkedin.com/in/yousafajan/",
    },
    {
        Image: "/Images/Kevin.jpg",
        name: "Kevin",
        role: "Executive Secretary",
        link: "https://www.linkedin.com/in/kevintheinnovator/",
    },
    {
        Image: "/Images/Wasay.png",
        name: "Wasay",
        role: "Executive Advisor",
        link: "https://www.linkedin.com/in/wasayaamir/",
        position: "54% 41%",
        zoom: 1.9,
    },
    {
        Image: "/Images/Taha.jpg",
        name: "Taha",
        role: "Executive Advisor",
        link: "https://www.linkedin.com/in/taha-rana-haha/",
    },
    {
        Image: "/Images/Hayden.jpg",
        name: "Hayden",
        role: "Executive Advisor",
        link: "https://www.linkedin.com/in/haydenpmac/",
    },
    {
        Image: "/Images/Edrees.jpg",
        name: "Edrees",
        role: "Technical Advisor",
        link: "https://www.linkedin.com/in/edrees-amiri/",
    },
];
export const teamData = {
  presidents,
  vicePresidents,
  tech: techTeam,
  marketing: marketingTeam,
  operations: operationsTeam,
  events: eventsTeam,
  sponsors: sponsorsTeam,
  advisors,
};