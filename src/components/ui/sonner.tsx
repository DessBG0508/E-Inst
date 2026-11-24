import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ position = "bottom-right", ...props }: ToasterProps) => {
  return (
    <Sonner
      position={position}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast h-auto rounded-lg border border-[#E5DFD3] bg-white text-[#1A1A1A] shadow-sm font-sans dark:border-[#2D3F2A] dark:bg-[#1A2618] dark:text-[#F5F1E8]",
          success: "!bg-[#8FC9B5] !text-white !border-[#7AB5A1]",
          error: "!bg-[#C8102E] !text-white !border-[#9B0C24]",
          info: "!bg-[#7B6FD8] !text-white !border-[#6A5FC9] dark:!bg-[#A89AE8] dark:!text-[#0F1A12] dark:!border-[#9584DE]",
          warning: "!bg-[#B8860B] !text-white !border-[#9C7200]",
          description: "!text-current opacity-95",
          actionButton: "group-[.toast]:bg-[#1F4D2C] group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-[#F5F1E8] group-[.toast]:text-[#6B6B6B] dark:group-[.toast]:bg-[#0F1A12] dark:group-[.toast]:text-[#A8B5A0]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
